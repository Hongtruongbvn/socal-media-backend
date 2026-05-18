Overview

This project is the backend API for the Socal Media social networking platform.
It provides authentication, social interactions, messaging, group management, AI chatbot support, payment integration, and game-related services for the frontend application.

Frontend Repository:
Socal Media Frontend : https://github.com/Hongtruongbvn/socal-media-frontend

Backend API Deployment:
Socal Media Backend API : https://socal-media-backend-qh5r.onrender.com/api

Important Notice

Because the backend and frontend are deployed separately, the backend server may enter sleep mode on Render after a period of inactivity.

Before accessing the frontend application, please open the backend API link first to wake up the server:

Wake Up Backend Server

After the API responds successfully, you can use the frontend normally.

Features
User Authentication with JWT
Email Verification & Password Reset
Real-time Messaging System
Group & Community Management
Friend Requests & Follow System
Posts, Comments, Reactions, and Reposts
Notifications System
AI Chatbot Integration
Game Information Integration via IGDB API
Stripe Payment Integration
MongoDB Database Support
RESTful API Architecture
Tech Stack
Backend
NestJS
MongoDB + Mongoose
JWT Authentication
Stripe API
Google AI API
Nodemailer
Frontend
React
TypeScript
SCSS
Vite
Environment Variables

Create a .env file in the root directory and configure the following variables:

# Email config
MAIL_USER=
MAIL_HOST=
MAIL_PASS=
MAIL_FROM=

# Database
MONGO_URI=

# Auth
JWT_SECRET=
JWT_EXPIRES_IN=

# IGDB API
IGDB_CLIENT_ID=
IGDB_CLIENT_SECRET=
API_URL=

# Google AI
GOOGLE_AI_API_KEY=
CHATBOT_USER_ID=

# Stripe (backend uses SECRET KEY)
STRIPE_SECRET_KEY=
Installation

Clone the repository:

git clone <your-backend-repository>

Install dependencies:

npm install

Run the development server:

npm run start:dev
API Base URL
https://socal-media-backend-qh5r.onrender.com/api
Frontend Setup

Clone the frontend project:

Frontend Repository

Install dependencies and run:

npm install
npm run dev
Deployment
Backend
Render
Frontend
Vercel / Render / Netlify (depending on deployment choice)
Notes
Make sure MongoDB Atlas is configured correctly.
Stripe requires a valid secret key.
Google AI features require a valid API key.
IGDB API credentials are required for game-related features.
Some API requests may be slow during the first request because Render free instances may sleep when inactive.
