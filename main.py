from fastapi import FastAPI, HTTPException, Depends, Form, UploadFile, File, Request, Response, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel, EmailStr, Field, HttpUrl
from typing import List, Optional, Union, Dict, Any
from pymongo import MongoClient
from bson import ObjectId
from jose import JWTError, jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta
import os
import requests
import base64
import secrets
import string
import time
import uvicorn
import motor.motor_asyncio
from dotenv import load_dotenv
import aiohttp
import asyncio

# Load environment variables
load_dotenv()

# Environment variables
MONGODB_URI = os.getenv("MONGODB_URI")
SECRET_KEY = os.getenv("SECRET_KEY", "".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(32)))
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 1 day
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD")
IMGBB_API_KEY = os.getenv("IMGBB_API_KEY")
BASE_URL = os.getenv("BASE_URL", "https://shivafabricator.com")

# FastAPI app
app = FastAPI(title="Shiva Fabrications API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB connection
client = motor.motor_asyncio.AsyncIOMotorClient(MONGODB_URI)
db = client.shiva_fabrications

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/token")

# Pydantic models
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

class User(BaseModel):
    email: str
    disabled: Optional[bool] = None

class UserInDB(User):
    hashed_password: str

class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return ObjectId(v)

    @classmethod
    def __modify_schema__(cls, field_schema):
        field_schema.update(type="string")

class ProjectBase(BaseModel):
    title: str
    completed_year: str
    location: str
    category: str
    overview: str
    scope_of_work: List[str]
    challenges: List[Dict[str, str]]  # {"challenge": "...", "solution": "..."}
    results: List[str]
    images: List[str]  # URLs of images
    slug: str
    active: bool = True
    enable_feedback: bool = True

    class Config:
        arbitrary_types_allowed = True
        json_encoders = {
            ObjectId: str
        }

class ProjectCreate(ProjectBase):
    pass

class Project(ProjectBase):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {
            ObjectId: str
        }

class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    completed_year: Optional[str] = None
    location: Optional[str] = None
    category: Optional[str] = None
    overview: Optional[str] = None
    scope_of_work: Optional[List[str]] = None
    challenges: Optional[List[Dict[str, str]]] = None
    results: Optional[List[str]] = None
    images: Optional[List[str]] = None
    slug: Optional[str] = None
    active: Optional[bool] = None
    enable_feedback: Optional[bool] = None

    class Config:
        arbitrary_types_allowed = True
        json_encoders = {
            ObjectId: str
        }

class ContactMessage(BaseModel):
    name: str
    email: EmailStr
    phone: str
    company: Optional[str] = None
    subject: str
    message: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        arbitrary_types_allowed = True
        json_encoders = {
            ObjectId: str
        }

class ContactMessageInDB(ContactMessage):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {
            ObjectId: str
        }

class Feedback(BaseModel):
    project_id: Optional[str] = None  # Make it optional
    company_name: str
    author_name: str
    rating: int = Field(..., ge=1, le=5)
    text: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    approved: bool = False
    feedback_code: str

    class Config:
        arbitrary_types_allowed = True
        json_encoders = {
            ObjectId: str
        }

class FeedbackInDB(Feedback):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {
            ObjectId: str
        }

class HealthCheck(BaseModel):
    status: str = "ok"
    timestamp: datetime = Field(default_factory=datetime.utcnow)

# Utility functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

async def get_user(email: str):
    if email == ADMIN_EMAIL:
        return UserInDB(
            email=ADMIN_EMAIL, 
            hashed_password=get_password_hash(ADMIN_PASSWORD),
            disabled=False
        )
    return None

async def authenticate_user(email: str, password: str):
    user = await get_user(email)
    if not user:
        return False
    if not verify_password(password, user.hashed_password):
        return False
    return user

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
        token_data = TokenData(email=email)
    except JWTError:
        raise credentials_exception
    user = await get_user(email=token_data.email)
    if user is None:
        raise credentials_exception
    return user

async def get_current_active_user(current_user: User = Depends(get_current_user)):
    if current_user.disabled:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

async def upload_image_to_imgbb(image_data, name=None):
    url = "https://api.imgbb.com/1/upload"
    payload = {
        "key": IMGBB_API_KEY,
    }
    
    if isinstance(image_data, bytes):
        # Convert binary data to base64
        base64_image = base64.b64encode(image_data).decode('utf-8')
        payload["image"] = base64_image
    else:
        # Assume it's a URL
        payload["image"] = image_data
        
    if name:
        payload["name"] = name
        
    try:
        response = requests.post(url, payload)
        response.raise_for_status()
        result = response.json()
        
        if result.get("success"):
            return result["data"]["url"]
        else:
            raise HTTPException(status_code=500, detail="Failed to upload image to ImgBB")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image upload failed: {str(e)}")

def generate_feedback_code():
    return ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(32))

def get_project_url(slug):
    return f"{BASE_URL}/projects/{slug}"

def get_feedback_url(code):
    return f"{BASE_URL}/feedback?code={code}"

# API routes
@app.post("/api/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    user = await authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/health", response_model=HealthCheck)
async def health_check():
    return HealthCheck()

@app.post("/api/projects", response_model=Project)
async def create_project(project: ProjectCreate, current_user: User = Depends(get_current_active_user)):
    # Check if slug already exists
    existing = await db.projects.find_one({"slug": project.slug})
    if existing:
        raise HTTPException(status_code=400, detail="Project with this slug already exists")
    
    project_dict = project.dict()
    project_dict["created_at"] = datetime.utcnow()
    project_dict["updated_at"] = project_dict["created_at"]
    
    result = await db.projects.insert_one(project_dict)
    created_project = await db.projects.find_one({"_id": result.inserted_id})
    
    # Generate a feedback code for this project
    feedback_code = generate_feedback_code()
    await db.feedback_codes.insert_one({
        "project_id": str(result.inserted_id),
        "code": feedback_code,
        "created_at": datetime.utcnow()
    })
    
    return created_project

@app.get("/api/projects", response_model=List[Project])
async def get_projects(
    skip: int = 0, 
    limit: int = 10, 
    category: Optional[str] = None,
    active_only: bool = True
):
    query = {"active": True} if active_only else {}
    if category:
        query["category"] = category
        
    projects = await db.projects.find(query).skip(skip).limit(limit).to_list(length=limit)
    return projects

@app.get("/api/projects/{slug}", response_model=Project)
async def get_project(slug: str):
    project = await db.projects.find_one({"slug": slug})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@app.put("/api/projects/{slug}", response_model=Project)
async def update_project(
    slug: str, 
    project_update: ProjectUpdate, 
    current_user: User = Depends(get_current_active_user)
):
    project = await db.projects.find_one({"slug": slug})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    update_data = project_update.dict(exclude_unset=True)
    
    if update_data:
        update_data["updated_at"] = datetime.utcnow()
        
        # If slug is being updated, check if the new slug already exists
        if "slug" in update_data and update_data["slug"] != slug:
            existing = await db.projects.find_one({"slug": update_data["slug"]})
            if existing:
                raise HTTPException(status_code=400, detail="Project with this slug already exists")
        
        await db.projects.update_one(
            {"slug": slug}, {"$set": update_data}
        )
    
    updated_project = await db.projects.find_one({"slug": update_data.get("slug", slug)})
    return updated_project

@app.delete("/api/projects/{slug}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(slug: str, current_user: User = Depends(get_current_active_user)):
    project = await db.projects.find_one({"slug": slug})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    await db.projects.delete_one({"slug": slug})
    # Delete associated feedback codes
    await db.feedback_codes.delete_many({"project_id": str(project["_id"])})
    # Delete associated feedback
    await db.feedback.delete_many({"project_id": str(project["_id"])})
    
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@app.post("/api/upload", response_model=Dict[str, str])
async def upload_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user)
):
    contents = await file.read()
    image_url = await upload_image_to_imgbb(contents, file.filename)
    return {"url": image_url}

@app.post("/api/contact", status_code=status.HTTP_201_CREATED)
async def create_contact_message(message: ContactMessage):
    message_dict = message.dict()
    result = await db.contact_messages.insert_one(message_dict)
    return {"id": str(result.inserted_id)}

@app.get("/api/contact", response_model=List[ContactMessageInDB])
async def get_contact_messages(
    skip: int = 0, 
    limit: int = 50,
    current_user: User = Depends(get_current_active_user)
):
    messages = await db.contact_messages.find().sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)
    return messages

@app.delete("/api/contact/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contact_message(
    message_id: str, 
    current_user: User = Depends(get_current_active_user)
):
    result = await db.contact_messages.delete_one({"_id": ObjectId(message_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Message not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@app.post("/api/feedback", status_code=status.HTTP_201_CREATED)
async def create_feedback(feedback: Feedback):
    # Verify the feedback code
    code_doc = await db.feedback_codes.find_one({"code": feedback.feedback_code})
    if not code_doc:
        raise HTTPException(status_code=400, detail="Invalid feedback code")
    
    # Check if the project exists
    project = await db.projects.find_one({"_id": ObjectId(code_doc["project_id"])})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check if feedback is enabled for this project
    if not project.get("enable_feedback", True):
        raise HTTPException(status_code=400, detail="Feedback is not enabled for this project")
    
    # Create the feedback
    feedback_dict = feedback.dict()
    feedback_dict["project_id"] = code_doc["project_id"]  # Set the project_id from the code lookup
    result = await db.feedback.insert_one(feedback_dict)
    
    return {"id": str(result.inserted_id)}

@app.get("/api/feedback", response_model=List[FeedbackInDB])
async def get_feedback(
    project_id: Optional[str] = None,
    approved_only: bool = False,
    current_user: User = Depends(get_current_active_user)
):
    query = {}
    if project_id:
        query["project_id"] = project_id
    if approved_only:
        query["approved"] = True
        
    feedback_list = await db.feedback.find(query).sort("created_at", -1).to_list(length=100)
    return feedback_list

@app.get("/api/public/feedback/{project_slug}", response_model=List[FeedbackInDB])
async def get_public_feedback(project_slug: str):
    project = await db.projects.find_one({"slug": project_slug})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Only return approved feedback for the specified project
    feedback_list = await db.feedback.find({
        "project_id": str(project["_id"]),
        "approved": True
    }).sort("created_at", -1).to_list(length=10)
    
    return feedback_list

@app.put("/api/feedback/{feedback_id}/approve", response_model=FeedbackInDB)
async def approve_feedback(
    feedback_id: str,
    current_user: User = Depends(get_current_active_user)
):
    result = await db.feedback.update_one(
        {"_id": ObjectId(feedback_id)},
        {"$set": {"approved": True}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Feedback not found")
    
    updated_feedback = await db.feedback.find_one({"_id": ObjectId(feedback_id)})
    return updated_feedback

@app.delete("/api/feedback/{feedback_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_feedback(
    feedback_id: str,
    current_user: User = Depends(get_current_active_user)
):
    result = await db.feedback.delete_one({"_id": ObjectId(feedback_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Feedback not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@app.get("/api/feedback/code/{project_slug}", response_model=Dict[str, str])
async def get_feedback_code(
    project_slug: str,
    current_user: User = Depends(get_current_active_user)
):
    project = await db.projects.find_one({"slug": project_slug})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    code_doc = await db.feedback_codes.find_one({"project_id": str(project["_id"])})
    
    if not code_doc:
        # Generate a new code if one doesn't exist
        code = generate_feedback_code()
        await db.feedback_codes.insert_one({
            "project_id": str(project["_id"]),
            "code": code,
            "created_at": datetime.utcnow()
        })
    else:
        code = code_doc["code"]
    
    feedback_url = get_feedback_url(code)
    return {"code": code, "url": feedback_url}

@app.get("/api/check-slug/{slug}")
async def check_slug_availability(slug: str):
    existing = await db.projects.find_one({"slug": slug})
    return {"available": existing is None}

@app.get("/api/categories")
async def get_categories():
    # Get all unique categories from projects
    categories = await db.projects.distinct("category")
    return {"categories": categories}

@app.get("/api/stats", response_model=Dict[str, Any])
async def get_stats(current_user: User = Depends(get_current_active_user)):
    # Get various stats for the dashboard
    total_projects = await db.projects.count_documents({})
    active_projects = await db.projects.count_documents({"active": True})
    total_messages = await db.contact_messages.count_documents({})
    total_feedback = await db.feedback.count_documents({})
    
    # Get projects by category
    categories = await db.projects.distinct("category")
    projects_by_category = {}
    for category in categories:
        count = await db.projects.count_documents({"category": category})
        projects_by_category[category] = count
    
    # Get average rating
    pipeline = [
        {"$group": {"_id": None, "avg_rating": {"$avg": "$rating"}}}
    ]
    avg_rating_result = await db.feedback.aggregate(pipeline).to_list(length=1)
    avg_rating = avg_rating_result[0]["avg_rating"] if avg_rating_result else 0
    
    return {
        "total_projects": total_projects,
        "active_projects": active_projects,
        "total_messages": total_messages,
        "total_feedback": total_feedback,
        "projects_by_category": projects_by_category,
        "average_rating": avg_rating
    }

# Keep the server alive by pinging the health endpoint every 10 minutes
async def keep_alive():
    while True:
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{BASE_URL}/api/health") as response:
                    print(f"Keep-alive ping: {response.status}")
        except Exception as e:
            print(f"Keep-alive error: {str(e)}")
        await asyncio.sleep(600)  # 10 minutes

@app.on_event("startup")
async def startup_event():
    # Start the keep-alive task
    asyncio.create_task(keep_alive())
    
    # Create indexes
    await db.projects.create_index("slug", unique=True)
    await db.feedback_codes.create_index("code", unique=True)
    await db.feedback_codes.create_index("project_id")
    await db.feedback.create_index("project_id")
    await db.feedback.create_index("approved")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
