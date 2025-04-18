from fastapi import FastAPI, HTTPException, Depends, Form, UploadFile, File, Request, Response, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse, FileResponse
from pydantic import BaseModel, EmailStr, Field, HttpUrl
from typing import List, Optional, Union, Dict, Any, Annotated
from pymongo import MongoClient, ASCENDING, DESCENDING
from bson import ObjectId, json_util
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
import uuid
from io import BytesIO
import json
from fastapi.encoders import jsonable_encoder
import jinja2
from pathlib import Path
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from starlette.requests import Request as StarletteRequest
from functools import lru_cache
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

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
BASE_URL = os.getenv("BASE_URL", "https://shivafabrications.versz.fun")
BROWSERLESS_API_KEY = os.getenv("BROWSERLESS_API_KEY")
EMAIL_ADDRESS = os.getenv("EMAIL_ADDRESS", "your-email@gmail.com")
EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD", "your-app-password")
EMAIL_SMTP_SERVER = os.getenv("EMAIL_SMTP_SERVER", "smtp.gmail.com")
EMAIL_SMTP_PORT = int(os.getenv("EMAIL_SMTP_PORT", "587"))

# Setup rate limiter
limiter = Limiter(key_func=get_remote_address)

# FastAPI app
app = FastAPI(title="Shiva Fabrications API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

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

# Cache for frequently accessed data
@lru_cache(maxsize=128)
def get_cached_data(key: str, expiry: int = 300):
    """Simple in-memory cache with expiry"""
    return None

# Helper function to serialize MongoDB documents
def serialize_mongo_doc(doc):
    """Convert MongoDB document to a JSON-serializable dict"""
    if doc is None:
        return None
    doc_dict = dict(doc)
    if '_id' in doc_dict and isinstance(doc_dict['_id'], ObjectId):
        doc_dict['_id'] = str(doc_dict['_id'])
    
    # Convert all ObjectId instances to strings
    for key, value in doc_dict.items():
        if isinstance(value, ObjectId):
            doc_dict[key] = str(value)
        elif isinstance(value, datetime):
            doc_dict[key] = value.isoformat()
        elif isinstance(value, list):
            for i, item in enumerate(value):
                if isinstance(item, dict):
                    for sub_key, sub_value in item.items():
                        if isinstance(sub_value, ObjectId):
                            value[i][sub_key] = str(sub_value)
                        elif isinstance(sub_value, datetime):
                            value[i][sub_key] = sub_value.isoformat()
    
    return doc_dict

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
    
    def __str__(self):
        return str(self)

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

class BillItem(BaseModel):
    sr_no: int
    hsn_code: Optional[str] = None
    description: str
    qty: Optional[str] = None
    unit: Optional[str] = None
    rate: float
    amount: float

class Bill(BaseModel):
    invoice_no: str
    date: str
    bill_to: str
    bill_to_address: str
    company_pan: Optional[str] = None
    suppliers_ref_no: Optional[str] = None
    buyers_order_no: Optional[str] = None
    other_terms: Optional[str] = None
    items: List[BillItem]
    sub_total: float
    gst: Optional[float] = None
    round_off: Optional[float] = None
    grand_total: float
    amount_in_words: str
    enable_feedback: bool = False
    project_slug: Optional[str] = None
    feedback_code: Optional[str] = None
    # New fields for company details
    company_name: str = "SHIVA FABRICATION"
    company_address: str = "Survey No.76, Bharat Mata Nagar, Dighi, Pune -411015"
    company_contact: str = "8805954132 / 9096553951"
    company_email: str = "shivfabricator1@gmail.com"
    company_pan_number: Optional[str] = "ABCDE1234F"  # Added PAN number
    bank_beneficiary: str = "SHIVA FABRICATION"
    bank_account_no: str = "110504180001097"
    bank_ifsc_code: str = "SVCB0000105"
    
    class Config:
        arbitrary_types_allowed = True
        json_encoders = {
            ObjectId: str
        }
        
class BillInDB(Bill):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    bill_code: str = Field(default_factory=lambda: str(uuid.uuid4()))
    
    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {
            ObjectId: str
        }

class BillUpdate(BaseModel):
    invoice_no: Optional[str] = None
    date: Optional[str] = None
    bill_to: Optional[str] = None
    bill_to_address: Optional[str] = None
    company_pan: Optional[str] = None
    suppliers_ref_no: Optional[str] = None
    buyers_order_no: Optional[str] = None
    other_terms: Optional[str] = None
    items: Optional[List[BillItem]] = None
    sub_total: Optional[float] = None
    gst: Optional[float] = None
    round_off: Optional[float] = None
    grand_total: Optional[float] = None
    amount_in_words: Optional[str] = None
    enable_feedback: Optional[bool] = None
    project_slug: Optional[str] = None
    # New fields for company details
    company_name: Optional[str] = None
    company_address: Optional[str] = None
    company_contact: Optional[str] = None
    company_email: Optional[str] = None
    company_pan_number: Optional[str] = None
    bank_beneficiary: Optional[str] = None
    bank_account_no: Optional[str] = None
    bank_ifsc_code: Optional[str] = None
    
    class Config:
        arbitrary_types_allowed = True
        json_encoders = {
            ObjectId: str
        }

class HealthCheck(BaseModel):
    status: str = "ok"
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class EmailAttachment(BaseModel):
    filename: str
    content_type: str
    content: str  # Base64 encoded content

class EmailRequest(BaseModel):
    to: List[EmailStr]
    cc: Optional[List[EmailStr]] = None
    bcc: Optional[List[EmailStr]] = None
    subject: str
    body_html: str
    body_text: Optional[str] = None
    attachments: Optional[List[EmailAttachment]] = None
    reply_to: Optional[EmailStr] = None

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
        async with aiohttp.ClientSession() as session:
            async with session.post(url, data=payload) as response:
                if response.status != 200:
                    error_text = await response.text()
                    logger.error(f"ImgBB error: {response.status} - {error_text}")
                    raise HTTPException(status_code=500, detail="Failed to upload image to ImgBB")
                
                result = await response.json()
                
                if result.get("success"):
                    return result["data"]["url"]
                else:
                    raise HTTPException(status_code=500, detail="Failed to upload image to ImgBB")
    except Exception as e:
        logger.error(f"Image upload failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Image upload failed: {str(e)}")

def generate_feedback_code():
    return ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(32))

def get_project_url(slug):
    return f"{BASE_URL}/projects/{slug}"

def get_feedback_url(code):
    return f"{BASE_URL}/feedback?code={code}"

def get_bill_url(bill_code):
    return f"{BASE_URL}/bill?code={bill_code}"

# Browserless PDF generation
async def generate_pdf_with_browserless(html_content: str) -> BytesIO:
    """
    Generate a PDF using Browserless.io headless Chrome service
    """
    browserless_url = f"https://chrome.browserless.io/pdf?token={BROWSERLESS_API_KEY}"
    
    # Configure PDF options
    payload = {
        "html": html_content,
        "options": {
            "printBackground": True,
            "format": "Letter",
            "margin": {
                "top": "1cm",
                "right": "1cm",
                "bottom": "1cm",
                "left": "1cm"
            },
            "preferCSSPageSize": True
        }
    }
    
    # Send request to Browserless
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                browserless_url,
                headers={"Content-Type": "application/json"},
                json=payload,
                timeout=30
            ) as response:
                if response.status != 200:
                    error_text = await response.text()
                    logger.error(f"Browserless error: {response.status} - {error_text}")
                    raise HTTPException(
                        status_code=500,
                        detail=f"PDF generation failed: {error_text}"
                    )
                
                # Return PDF content as BytesIO object
                pdf_content = await response.read()
                pdf_buffer = BytesIO(pdf_content)
                pdf_buffer.seek(0)
                return pdf_buffer
                
    except Exception as e:
        logger.error(f"Error generating PDF: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"PDF generation failed: {str(e)}"
        )

def render_bill_template(bill):
    """Render HTML bill template using Jinja2"""
    # Create a Jinja2 template environment
    template_dir = Path(__file__).parent / "templates"
    if not template_dir.exists():
        template_dir.mkdir(parents=True)
    
    # Create bill HTML template
    template_path = template_dir / "bill_template.html"
    with open(template_path, "w") as f:
        f.write('''
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invoice #{{ bill.invoice_no }}</title>
    <style>
        @page {
            size: letter;
            margin: 1cm;
        }
        
        body {
            font-family: 'Helvetica', 'Arial', sans-serif;
            font-size: 10pt;
            line-height: 1.4;
            color: #333;
            margin: 0;
            padding: 0;
        }
        
        .bill-container {
            max-width: 800px;
            margin: 0 auto;
        }
        
        .bill-header {
            background-color: #f8f9fa;
            padding: 20px;
            border-bottom: 1px solid #eee;
            display: flex;
            justify-content: space-between;
        }
        
        .bill-company {
            flex: 1;
        }
        
        .bill-company h2 {
            font-size: 18pt;
            color: #2c3e50;
            margin: 0 0 10px 0;
        }
        
        .bill-company p {
            margin: 5px 0;
            color: #555;
            font-size: 9pt;
        }
        
        .bill-title {
            text-align: right;
        }
        
        .bill-title h1 {
            font-size: 22pt;
            color: #00c6ff;
            margin: 0 0 10px 0;
        }
        
        .bill-title p {
            margin: 5px 0;
        }
        
        .bill-details {
            padding: 20px;
        }
        
        .bill-info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
        }
        
        .bill-to {
            flex: 1;
        }
        
        .bill-meta {
            flex: 1;
        }
        
        .bill-to h3, .bill-meta h3 {
            font-size: 12pt;
            color: #2c3e50;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 1px solid #eee;
        }
        
        .bill-to p {
            margin: 5px 0;
            color: #555;
        }
        
        .bill-meta-item {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
        }
        
        .bill-meta-label {
            font-weight: bold;
            color: #555;
        }
        
        .bill-meta-value {
            color: #333;
        }
        
        .bill-items {
            margin-bottom: 30px;
        }
        
        .bill-items table {
            width: 100%;
            border-collapse: collapse;
        }
        
        .bill-items th {
            background-color: #f8f9fa;
            color: #333;
            padding: 10px;
            text-align: left;
            font-weight: bold;
            border-bottom: 2px solid #eee;
        }
        
        .bill-items td {
            padding: 10px;
            border-bottom: 1px solid #eee;
            color: #555;
        }
        
        .text-right {
            text-align: right;
        }
        
        .bill-total {
            margin-top: 20px;
            border-top: 2px solid #eee;
            padding-top: 20px;
        }
        
        .bill-total-row {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 10px;
        }
        
        .bill-total-label {
            width: 150px;
            text-align: right;
            padding-right: 20px;
            font-weight: bold;
            color: #555;
        }
        
        .bill-total-value {
            width: 150px;
            text-align: right;
            color: #333;
        }
        
        .bill-grand-total {
            font-size: 12pt;
            font-weight: bold;
            color: #2c3e50;
        }
        
        .bill-words {
            margin: 20px 0;
            font-style: italic;
            color: #555;
        }
        
        .bill-footer {
            display: flex;
            justify-content: space-between;
            margin-top: 50px;
            padding-top: 30px;
            border-top: 1px solid #eee;
        }
        
        .bill-signature {
            width: 40%;
            text-align: center;
        }
        
        .bill-signature-title {
            margin-bottom: 50px;
            font-weight: bold;
            color: #555;
        }
        
        .bill-signature-line {
            width: 100%;
            border-top: 1px solid #555;
            margin-bottom: 10px;
        }
        
        .bill-signature-name {
            font-weight: bold;
            color: #333;
        }
        
        .bill-notes {
            margin-top: 30px;
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
            font-size: 9pt;
            color: #555;
        }
        
        .bill-bank {
            margin-top: 30px;
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
        }
        
        .bill-bank h3 {
            font-size: 11pt;
            color: #2c3e50;
            margin-bottom: 15px;
        }
        
        .bill-bank p {
            margin: 5px 0;
            color: #555;
        }
        
        .feedback-link {
            margin-top: 20px;
            text-align: center;
            font-size: 8pt;
            color: #777;
        }
        
        .page-number {
            text-align: center;
            font-size: 8pt;
            color: #777;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="bill-container">
        <div class="bill-header">
            <div class="bill-company">
                <h2>{{ bill.company_name }}</h2>
                <p>{{ bill.company_address }}</p>
                <p>Contact: {{ bill.company_contact }}</p>
                <p>Email: {{ bill.company_email }}</p>
                {% if bill.company_pan_number %}
                <p>PAN: {{ bill.company_pan_number }}</p>
                {% endif %}
            </div>
            <div class="bill-title">
                <h1>INVOICE</h1>
                <p><strong>Invoice No:</strong> {{ bill.invoice_no }}</p>
                <p><strong>Date:</strong> {{ bill.date }}</p>
            </div>
        </div>
        
        <div class="bill-details">
            <div class="bill-info-row">
                <div class="bill-to">
                    <h3>Bill To</h3>
                    <p><strong>{{ bill.bill_to }}</strong></p>
                    <p>{{ bill.bill_to_address }}</p>
                </div>
                
                <div class="bill-meta">
                    <h3>Invoice Details</h3>
                    {% if bill.company_pan %}
                    <div class="bill-meta-item">
                        <span class="bill-meta-label">Company PAN:</span>
                        <span class="bill-meta-value">{{ bill.company_pan }}</span>
                    </div>
                    {% endif %}
                    
                    {% if bill.suppliers_ref_no %}
                    <div class="bill-meta-item">
                        <span class="bill-meta-label">Supplier's Ref No:</span>
                        <span class="bill-meta-value">{{ bill.suppliers_ref_no }}</span>
                    </div>
                    {% endif %}
                    
                    {% if bill.buyers_order_no %}
                    <div class="bill-meta-item">
                        <span class="bill-meta-label">Buyer's Order No:</span>
                        <span class="bill-meta-value">{{ bill.buyers_order_no }}</span>
                    </div>
                    {% endif %}
                    
                    {% if bill.other_terms %}
                    <div class="bill-meta-item">
                        <span class="bill-meta-label">Other Terms:</span>
                        <span class="bill-meta-value">{{ bill.other_terms }}</span>
                    </div>
                    {% endif %}
                </div>
            </div>
            
            <div class="bill-items">
                <table>
                    <thead>
                        <tr>
                            <th>Sr.No.</th>
                            <th>HSN/SAC</th>
                            <th>Description</th>
                            <th>Qty</th>
                            <th>Unit</th>
                            <th class="text-right">Rate</th>
                            <th class="text-right">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        {% for item in bill.items %}
                        <tr>
                            <td>{{ item.sr_no }}</td>
                            <td>{{ item.hsn_code or '-' }}</td>
                            <td>{{ item.description }}</td>
                            <td>{{ item.qty or '-' }}</td>
                            <td>{{ item.unit or '-' }}</td>
                            <td class="text-right">₹{{ "%.2f"|format(item.rate) }}</td>
                            <td class="text-right">₹{{ "%.2f"|format(item.amount) }}</td>
                        </tr>
                        {% endfor %}
                    </tbody>
                </table>
            </div>
            
            <div class="bill-total">
                <div class="bill-total-row">
                    <div class="bill-total-label">Sub Total:</div>
                    <div class="bill-total-value">₹{{ "%.2f"|format(bill.sub_total) }}</div>
                </div>
                
                {% if bill.gst %}
                <div class="bill-total-row">
                    <div class="bill-total-label">GST:</div>
                    <div class="bill-total-value">₹{{ "%.2f"|format(bill.gst) }}</div>
                </div>
                {% endif %}
                
                {% if bill.round_off %}
                <div class="bill-total-row">
                    <div class="bill-total-label">Round Off:</div>
                    <div class="bill-total-value">₹{{ "%.2f"|format(bill.round_off) }}</div>
                </div>
                {% endif %}
                
                <div class="bill-total-row">
                    <div class="bill-total-label bill-grand-total">Grand Total:</div>
                    <div class="bill-total-value bill-grand-total">₹{{ "%.2f"|format(bill.grand_total) }}</div>
                </div>
            </div>
            
            <div class="bill-words">
                <strong>Amount in words:</strong> {{ bill.amount_in_words }}
            </div>
            
            <div class="bill-footer">
                <div class="bill-signature">
                    <div class="bill-signature-title">Customer Seal and Signature</div>
                    <div class="bill-signature-line"></div>
                </div>
                
                <div class="bill-signature">
                    <div class="bill-signature-title">For {{ bill.company_name }}</div>
                    <div class="bill-signature-line"></div>
                    <div class="bill-signature-name">Proprietor</div>
                </div>
            </div>
            
            <div class="bill-bank">
                <h3>Bank Details</h3>
                <p>Name of the Beneficiary: {{ bill.bank_beneficiary }}</p>
                <p>A/C NO. {{ bill.bank_account_no }}</p>
                <p>IFSC CODE: {{ bill.bank_ifsc_code }}</p>
            </div>
            
            <div class="bill-notes">
                <p><strong>Declaration:</strong> We declare that this invoice shows the actual price of the labour work described and that all particulars are true and correct.</p>
            </div>
            
            {% if bill.enable_feedback and bill.feedback_code %}
            <div class="feedback-link">
                <p>Please provide your feedback at: {{ base_url }}/feedback?code={{ bill.feedback_code }}</p>
            </div>
            {% endif %}
            
            <div class="page-number">
                Page 1 of 1
            </div>
        </div>
    </div>
</body>
</html>
        ''')
    
    # Create a Jinja2 environment and load the template
    env = jinja2.Environment(loader=jinja2.FileSystemLoader(template_dir))
    template = env.get_template("bill_template.html")
    
    # Render the template with the bill data
    base_url = os.getenv("BASE_URL", "https://shivafabrications.versz.fun")
    html_content = template.render(bill=bill, base_url=base_url)
    
    return html_content

# Email sending functionality
async def send_email(email_request: EmailRequest):
    """Send an email with optional attachments"""
    try:
        # Create the email message
        msg = MIMEMultipart('alternative')
        msg['Subject'] = email_request.subject
        msg['From'] = EMAIL_ADDRESS
        msg['To'] = ', '.join(email_request.to)
        
        if email_request.cc:
            msg['Cc'] = ', '.join(email_request.cc)
        
        if email_request.reply_to:
            msg['Reply-To'] = email_request.reply_to
            
        # Add text part
        if email_request.body_text:
            msg.attach(MIMEText(email_request.body_text, 'plain'))
        else:
            # Create a plain text version from HTML if not provided
            plain_text = email_request.body_html.replace('<br>', '\n').replace('</p>', '\n').replace('<li>', '- ')
            # Remove HTML tags
            import re
            plain_text = re.sub(r'<[^>]*>', '', plain_text)
            msg.attach(MIMEText(plain_text, 'plain'))
        
        # Add HTML part
        msg.attach(MIMEText(email_request.body_html, 'html'))
        
        # Add attachments if any
        if email_request.attachments:
            for attachment in email_request.attachments:
                part = MIMEApplication(
                    base64.b64decode(attachment.content),
                    Name=attachment.filename
                )
                part['Content-Disposition'] = f'attachment; filename="{attachment.filename}"'
                part['Content-Type'] = f'{attachment.content_type}; name="{attachment.filename}"'
                msg.attach(part)
        
        # Create a list of all recipients
        all_recipients = email_request.to.copy()
        if email_request.cc:
            all_recipients.extend(email_request.cc)
        if email_request.bcc:
            all_recipients.extend(email_request.bcc)
        
        # Send the email
        with smtplib.SMTP(EMAIL_SMTP_SERVER, EMAIL_SMTP_PORT) as server:
            server.starttls()
            server.login(EMAIL_ADDRESS, EMAIL_PASSWORD)
            server.sendmail(EMAIL_ADDRESS, all_recipients, msg.as_string())
        
        return True
    except Exception as e:
        logger.error(f"Error sending email: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")

# API routes
@app.post("/api/token", response_model=Token)
@limiter.limit("10/minute")
async def login_for_access_token(request: StarletteRequest, form_data: OAuth2PasswordRequestForm = Depends()):
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
@limiter.limit("60/minute")
async def health_check(request: StarletteRequest):
    return HealthCheck()

@app.get("/api/feedback/code-info/{code}", response_model=Dict[str, Any])
@limiter.limit("20/minute")
async def get_feedback_code_info(code: str, request: StarletteRequest):
    """Verify if a feedback code exists and return project information"""
    code_doc = await db.feedback_codes.find_one({"code": code})
    if not code_doc:
        raise HTTPException(status_code=404, detail="Invalid feedback code")
    
    # Get project information
    project = None
    if code_doc.get("project_id"):
        project = await db.projects.find_one({"_id": ObjectId(code_doc["project_id"])})
    
    return {
        "valid": True,
        "project_name": project["title"] if project else None,
        "service_type": project["category"] if project else None
    }

@app.post("/api/projects", response_model=Project)
@limiter.limit("30/minute")
async def create_project(project: ProjectCreate, request: StarletteRequest, current_user: User = Depends(get_current_active_user)):
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
@limiter.limit("60/minute")
async def get_projects(
    request: StarletteRequest,
    skip: int = 0, 
    limit: int = 10, 
    category: Optional[str] = None,
    active_only: bool = True
):
    query = {"active": True} if active_only else {}
    if category:
        query["category"] = category
    
    # Check cache for common queries
    cache_key = f"projects_{skip}_{limit}_{category}_{active_only}"
    cached_data = get_cached_data(cache_key)
    if cached_data:
        return cached_data
        
    # Get total count for pagination
    total_count = await db.projects.count_documents(query)
    
    # Get projects with efficient sorting and projection
    projects = await db.projects.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)
    
    return projects

@app.get("/api/projects/{slug}", response_model=Project)
@limiter.limit("60/minute")
async def get_project(slug: str, request: StarletteRequest):
    # Check cache
    cache_key = f"project_{slug}"
    cached_data = get_cached_data(cache_key)
    if cached_data:
        return cached_data
    
    project = await db.projects.find_one({"slug": slug})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@app.put("/api/projects/{slug}", response_model=Project)
@limiter.limit("30/minute")
async def update_project(
    slug: str, 
    project_update: ProjectUpdate,
    request: StarletteRequest,
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
@limiter.limit("20/minute")
async def delete_project(slug: str, request: StarletteRequest, current_user: User = Depends(get_current_active_user)):
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
@limiter.limit("30/minute")
async def upload_image(
    request: StarletteRequest,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user)
):
    contents = await file.read()
    image_url = await upload_image_to_imgbb(contents, file.filename)
    return {"url": image_url}

@app.post("/api/contact", status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def create_contact_message(message: ContactMessage, request: StarletteRequest):
    message_dict = message.dict()
    result = await db.contact_messages.insert_one(message_dict)
    
    # Send notification email to admin
    try:
        email_request = EmailRequest(
            to=[ADMIN_EMAIL],
            subject=f"New Contact Form Submission: {message.subject}",
            body_html=f"""
            <h2>New Contact Form Submission</h2>
            <p><strong>Name:</strong> {message.name}</p>
            <p><strong>Email:</strong> {message.email}</p>
            <p><strong>Phone:</strong> {message.phone}</p>
            <p><strong>Company:</strong> {message.company or 'Not provided'}</p>
            <p><strong>Subject:</strong> {message.subject}</p>
            <p><strong>Message:</strong></p>
            <p>{message.message}</p>
            <hr>
            <p>This is an automated notification from your website.</p>
            """,
            reply_to=message.email
        )
        await send_email(email_request)
    except Exception as e:
        logger.error(f"Failed to send contact notification email: {str(e)}")
        # Continue even if email fails - the contact is still saved
    
    return {"id": str(result.inserted_id)}

@app.get("/api/contact", response_model=List[ContactMessageInDB])
@limiter.limit("30/minute")
async def get_contact_messages(
    request: StarletteRequest,
    skip: int = 0, 
    limit: int = 50,
    current_user: User = Depends(get_current_active_user)
):
    messages = await db.contact_messages.find().sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)
    return messages

@app.delete("/api/contact/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("20/minute")
async def delete_contact_message(
    message_id: str,
    request: StarletteRequest,
    current_user: User = Depends(get_current_active_user)
):
    result = await db.contact_messages.delete_one({"_id": ObjectId(message_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Message not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@app.post("/api/feedback", status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def create_feedback(feedback: Feedback, request: StarletteRequest):
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
    
    # Send notification email to admin
    try:
        email_request = EmailRequest(
            to=[ADMIN_EMAIL],
            subject=f"New Feedback Received: {feedback.company_name}",
            body_html=f"""
            <h2>New Feedback Received</h2>
            <p><strong>Company:</strong> {feedback.company_name}</p>
            <p><strong>Author:</strong> {feedback.author_name}</p>
            <p><strong>Rating:</strong> {feedback.rating}/5</p>
            <p><strong>Project:</strong> {project['title']}</p>
            <p><strong>Feedback:</strong></p>
            <p>{feedback.text}</p>
            <hr>
            <p>This feedback is awaiting approval.</p>
            """,
        )
        await send_email(email_request)
    except Exception as e:
        logger.error(f"Failed to send feedback notification email: {str(e)}")
        # Continue even if email fails - the feedback is still saved
    
    return {"id": str(result.inserted_id)}

@app.get("/api/feedback", response_model=List[FeedbackInDB])
@limiter.limit("30/minute")
async def get_feedback(
    request: StarletteRequest,
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
@limiter.limit("60/minute")
async def get_public_feedback(project_slug: str, request: StarletteRequest):
    # Check cache
    cache_key = f"public_feedback_{project_slug}"
    cached_data = get_cached_data(cache_key)
    if cached_data:
        return cached_data
        
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
@limiter.limit("30/minute")
async def approve_feedback(
    feedback_id: str,
    request: StarletteRequest,
    current_user: User = Depends(get_current_active_user)
):
    result = await db.feedback.update_one(
        {"_id": ObjectId(feedback_id)},
        {"$set": {"approved": True}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Feedback not found")
    
    updated_feedback = await db.feedback.find_one({"_id": ObjectId(feedback_id)})
    
    # Send thank you email to the company if we have their email
    feedback = await db.feedback.find_one({"_id": ObjectId(feedback_id)})
    project = await db.projects.find_one({"_id": ObjectId(feedback["project_id"])})
    
    # Find contact message with matching company name to get email
    company_contact = await db.contact_messages.find_one({"company": feedback["company_name"]})
    if company_contact and project:
        try:
            email_request = EmailRequest(
                to=[company_contact["email"]],
                subject=f"Thank you for your feedback on {project['title']}",
                body_html=f"""
                <h2>Thank You for Your Feedback</h2>
                <p>Dear {feedback["author_name"]},</p>
                <p>Thank you for taking the time to provide feedback on our work for the {project['title']} project.</p>
                <p>We appreciate your rating of {feedback["rating"]}/5 and your valuable comments.</p>
                <p>Your feedback has been approved and is now visible on our website.</p>
                <p>We look forward to working with you again in the future.</p>
                <br>
                <p>Best regards,</p>
                <p>The Shiva Fabrications Team</p>
                """,
            )
            await send_email(email_request)
        except Exception as e:
            logger.error(f"Failed to send feedback approval email: {str(e)}")
            # Continue even if email fails
    
    return updated_feedback

@app.delete("/api/feedback/{feedback_id}", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("20/minute")
async def delete_feedback(
    feedback_id: str,
    request: StarletteRequest,
    current_user: User = Depends(get_current_active_user)
):
    result = await db.feedback.delete_one({"_id": ObjectId(feedback_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Feedback not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@app.get("/api/feedback/code/{project_slug}", response_model=Dict[str, str])
@limiter.limit("30/minute")
async def get_feedback_code(
    project_slug: str,
    request: StarletteRequest,
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
@limiter.limit("30/minute")
async def check_slug_availability(slug: str, request: StarletteRequest):
    existing = await db.projects.find_one({"slug": slug})
    return {"available": existing is None}

@app.get("/api/categories")
@limiter.limit("60/minute")
async def get_categories(request: StarletteRequest):
    # Check cache
    cache_key = "categories"
    cached_data = get_cached_data(cache_key)
    if cached_data:
        return {"categories": cached_data}
        
    # Get all unique categories from projects
    categories = await db.projects.distinct("category")
    return {"categories": categories}

@app.get("/api/stats", response_model=Dict[str, Any])
@limiter.limit("30/minute")
async def get_stats(request: StarletteRequest, current_user: User = Depends(get_current_active_user)):
    # Check cache
    cache_key = "admin_stats"
    cached_data = get_cached_data(cache_key)
    if cached_data:
        return cached_data
        
    # Get various stats for the dashboard
    total_projects = await db.projects.count_documents({})
    active_projects = await db.projects.count_documents({"active": True})
    total_messages = await db.contact_messages.count_documents({})
    total_feedback = await db.feedback.count_documents({})
    total_bills = await db.bills.count_documents({})
    
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
        "total_bills": total_bills,
        "projects_by_category": projects_by_category,
        "average_rating": avg_rating
    }

# Bill-related endpoints
@app.post("/api/bills", response_model=Dict[str, Any])
@limiter.limit("30/minute")
async def create_bill(bill: Bill, request: StarletteRequest, current_user: User = Depends(get_current_active_user)):
    bill_dict = bill.dict()
    
    # Handle feedback linking if needed
    if bill.enable_feedback and bill.project_slug:
        project = await db.projects.find_one({"slug": bill.project_slug})
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Get or create feedback code
        code_doc = await db.feedback_codes.find_one({"project_id": str(project["_id"])})
        if not code_doc:
            feedback_code = generate_feedback_code()
            await db.feedback_codes.insert_one({
                "project_id": str(project["_id"]),
                "code": feedback_code,
                "created_at": datetime.utcnow()
            })
        else:
            feedback_code = code_doc["code"]
        
        bill_dict["feedback_code"] = feedback_code
    
    # Generate a unique bill code
    bill_dict["bill_code"] = str(uuid.uuid4())
    bill_dict["created_at"] = datetime.utcnow()
    bill_dict["updated_at"] = bill_dict["created_at"]
    
    result = await db.bills.insert_one(bill_dict)
    created_bill = await db.bills.find_one({"_id": result.inserted_id})
    
    # Convert ObjectId to string for JSON serialization
    created_bill = serialize_mongo_doc(created_bill)
    
    # Return the bill with its public URL
    bill_url = get_bill_url(created_bill["bill_code"])
    return {**created_bill, "bill_url": bill_url}

@app.get("/api/bills", response_model=List[Dict[str, Any]])
@limiter.limit("30/minute")
async def get_bills(
    request: StarletteRequest,
    skip: int = 0,
    limit: int = 20,
    current_user: User = Depends(get_current_active_user)
):
    # Get total count for pagination
    total_count = await db.bills.count_documents({})
    
    # Use more efficient cursor-based pagination
    bills_cursor = db.bills.find().sort("created_at", -1).skip(skip).limit(limit)
    bills = []
    
    async for bill in bills_cursor:
        # Convert to a serializable format
        bill_dict = serialize_mongo_doc(bill)
        bill_dict["bill_url"] = get_bill_url(bill_dict["bill_code"])
        bills.append(bill_dict)
    
    return bills

@app.get("/api/bills/{bill_id}", response_model=Dict[str, Any])
@limiter.limit("30/minute")
async def get_bill_by_id(bill_id: str, request: StarletteRequest, current_user: User = Depends(get_current_active_user)):
    bill = await db.bills.find_one({"_id": ObjectId(bill_id)})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    
    # Convert to a serializable format
    bill_dict = serialize_mongo_doc(bill)
    bill_dict["bill_url"] = get_bill_url(bill_dict["bill_code"])
    
    return bill_dict

@app.put("/api/bills/{bill_id}", response_model=Dict[str, Any])
@limiter.limit("30/minute")
async def update_bill(
    bill_id: str,
    bill_update: BillUpdate,
    request: StarletteRequest,
    current_user: User = Depends(get_current_active_user)
):
    bill = await db.bills.find_one({"_id": ObjectId(bill_id)})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    
    update_data = bill_update.dict(exclude_unset=True)
    
    # Handle feedback linking if needed
    if "enable_feedback" in update_data and update_data["enable_feedback"] and "project_slug" in update_data:
        project = await db.projects.find_one({"slug": update_data["project_slug"]})
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Get or create feedback code
        code_doc = await db.feedback_codes.find_one({"project_id": str(project["_id"])})
        if not code_doc:
            feedback_code = generate_feedback_code()
            await db.feedback_codes.insert_one({
                "project_id": str(project["_id"]),
                "code": feedback_code,
                "created_at": datetime.utcnow()
            })
        else:
            feedback_code = code_doc["code"]
        
        update_data["feedback_code"] = feedback_code
    
    if update_data:
        update_data["updated_at"] = datetime.utcnow()
        await db.bills.update_one(
            {"_id": ObjectId(bill_id)}, {"$set": update_data}
        )
    
    updated_bill = await db.bills.find_one({"_id": ObjectId(bill_id)})
    
    # Convert to a serializable format
    updated_bill_dict = serialize_mongo_doc(updated_bill)
    updated_bill_dict["bill_url"] = get_bill_url(updated_bill_dict["bill_code"])
    
    return updated_bill_dict

@app.delete("/api/bills/{bill_id}", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("20/minute")
async def delete_bill(bill_id: str, request: StarletteRequest, current_user: User = Depends(get_current_active_user)):
    result = await db.bills.delete_one({"_id": ObjectId(bill_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Bill not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@app.get("/api/bills/{bill_id}/download")
@limiter.limit("30/minute")
async def download_bill_pdf(bill_id: str, request: StarletteRequest):
    bill = await db.bills.find_one({"_id": ObjectId(bill_id)})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    
    # Convert to BillInDB model
    bill_model = BillInDB(**serialize_mongo_doc(bill))
    
    try:
        # Generate HTML content from template
        html_content = render_bill_template(bill_model)
        
        # Generate PDF using Browserless
        pdf_buffer = await generate_pdf_with_browserless(html_content)
        
        # Create a temporary file
        temp_file = f"/tmp/{bill['bill_code']}.pdf"
        with open(temp_file, "wb") as f:
            f.write(pdf_buffer.read())
        
        return FileResponse(
            path=temp_file,
            filename=f"invoice_{bill['invoice_no']}.pdf",
            media_type="application/pdf"
        )
    
    except Exception as e:
        logger.error(f"Error generating PDF: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate PDF: {str(e)}"
        )

@app.get("/api/public/bill/{bill_code}", response_model=Dict[str, Any])
@limiter.limit("60/minute")
async def get_bill_by_code(bill_code: str, request: StarletteRequest):
    """Get bill data by its public code - accessible without authentication"""
    # Check cache
    cache_key = f"public_bill_{bill_code}"
    cached_data = get_cached_data(cache_key)
    if cached_data:
        return cached_data
        
    bill = await db.bills.find_one({"bill_code": bill_code})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    
    # Convert to a serializable format
    bill_dict = serialize_mongo_doc(bill)
    
    # Add download URL
    bill_dict["download_url"] = f"/api/bills/{bill_dict['_id']}/download"
    
    # Add feedback URL if applicable
    if bill_dict.get("enable_feedback") and bill_dict.get("feedback_code"):
        bill_dict["feedback_url"] = get_feedback_url(bill_dict["feedback_code"])
    
    # Add company details
    bill_dict["company"] = {
        "name": "SHIVA FABRICATION",
        "address": "Survey No.76, Bharat Mata Nagar, Dighi, Pune -411015",
        "contact": "8805954132 / 9096553951",
        "email": "shivfabricator1@gmail.com",
        "bank_details": {
            "beneficiary": "SHIVA FABRICATION",
            "account_no": "110504180001097",
            "ifsc_code": "SVCB0000105"
        }
    }
    
    return bill_dict

# New email sending endpoint
@app.post("/api/send-email", status_code=status.HTTP_200_OK)
@limiter.limit("10/minute")
async def send_email_endpoint(
    email_request: EmailRequest,
    request: StarletteRequest,
    current_user: User = Depends(get_current_active_user)
):
    """
    Send an email with HTML formatting and optional attachments
    """
    try:
        success = await send_email(email_request)
        return {"status": "success", "message": "Email sent successfully"}
    except Exception as e:
        logger.error(f"Failed to send email: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to send email: {str(e)}"
        )

# Keep the server alive by pinging the health endpoint every 10 minutes
async def keep_alive():
    while True:
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"https://shivfabricator.onrender.com/api/health") as response:
                    logger.info(f"Keep-alive ping: {response.status}")
        except Exception as e:
            logger.error(f"Keep-alive error: {str(e)}")
        await asyncio.sleep(600)  # 10 minutes

# Periodic cache cleanup
async def cleanup_cache():
    while True:
        try:
            # Clear the LRU cache periodically
            get_cached_data.cache_clear()
            logger.info("Cache cleared")
        except Exception as e:
            logger.error(f"Cache cleanup error: {str(e)}")
        await asyncio.sleep(3600)  # Every hour

@app.on_event("startup")
async def startup_event():
    # Start the keep-alive task
    asyncio.create_task(keep_alive())
    
    # Start cache cleanup task
    asyncio.create_task(cleanup_cache())
    
    # Create indexes
    await db.projects.create_index("slug", unique=True)
    await db.projects.create_index([("created_at", DESCENDING)])
    await db.projects.create_index("category")
    await db.projects.create_index("active")
    
    await db.feedback_codes.create_index("code", unique=True)
    await db.feedback_codes.create_index("project_id")
    
    await db.feedback.create_index("project_id")
    await db.feedback.create_index("approved")
    await db.feedback.create_index([("created_at", DESCENDING)])
    
    # New indexes for bills
    await db.bills.create_index("bill_code", unique=True)
    await db.bills.create_index([("created_at", DESCENDING)])
    await db.bills.create_index("invoice_no")
    
    # Indexes for contact messages
    await db.contact_messages.create_index([("created_at", DESCENDING)])
    await db.contact_messages.create_index("email")
    await db.contact_messages.create_index("company")
    
    logger.info("Application started and indexes created")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
