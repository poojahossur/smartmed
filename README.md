# SmartMed

SmartMed is an AI-powered medicine management and healthcare assistance platform designed to help users manage medications, receive automated reminders, monitor medication adherence, and access AI-assisted healthcare information.

The platform combines medication scheduling, SMS and voice reminders, interactive voice confirmation, caregiver notifications, prescription analysis, medicine substitution information, adherence tracking, and healthcare discovery.

## Live Demo

[View SmartMed Live Demo](https://smartmed-4yt8.onrender.com/)

> The live demo uses Firebase, Google Gemini, and Twilio integrations. Some functionality depends on the availability and configuration of these services.

---

## Key Features

- **Medication Management** — Add and manage medicines, dosage, frequency, schedules, and instructions.
- **Automated SMS Reminders** — Send medication reminders through SMS.
- **Voice Call Reminders** — Automatically call users at scheduled medication times.
- **Interactive Voice Confirmation** — Users can respond to voice reminders using keypad input.
- **Caregiver Notifications** — Notify registered caregivers when medication reminders are missed.
- **AI Medicine Assistant** — Provides AI-assisted medication and healthcare information using Google Gemini.
- **Prescription Analysis** — Extract and organize medication information from prescription images.
- **Medicine Substitution Information** — Provides AI-assisted information about potential alternatives that should be verified by a healthcare professional.
- **Medication Adherence Tracking** — Track medication states such as taken, missed, pending, and late.
- **Healthcare Discovery** — Help users discover relevant healthcare facilities and services.

---

## How It Works

```text
                    SmartMed
                       |
        +--------------+--------------+
        |              |              |
        v              v              v
    Firebase        Gemini          Twilio
        |              |              |
        v              v              v
   User &          AI-Assisted     SMS / Voice
  Medication       Information     Reminders
     Data
        |
        v
 Medication
  Adherence
```

The application uses a React and TypeScript frontend with a Node.js and Express backend.

Firebase provides authentication and cloud data storage, Google Gemini powers AI-assisted functionality, and Twilio handles SMS and voice communication.

## Interactive Voice Reminder

A key feature of SmartMed is its interactive medication reminder through voice calls.

```text
Medication Schedule
        |
        v
Reminder Trigger
        |
        v
Twilio Voice Call
        |
        +----------------------+
        |                      |
        v                      v
      Press 1                Press 2
  Medication Taken      Remind Again Later
```

The system processes keypad input using DTMF and updates the medication status accordingly.

---

## Technology Stack

| Category | Technologies |
|---|---|
| Frontend | React, TypeScript, Vite |
| Styling | Tailwind CSS |
| Backend | Node.js, Express |
| Database | Firebase Firestore |
| Authentication | Firebase Authentication |
| AI | Google Gemini API |
| Communication | Twilio SMS, Twilio Voice, DTMF |
| Healthcare / Maps | Leaflet, OpenStreetMap |
| Deployment | Render |
| Version Control | Git, GitHub |

---

## Installation

### Prerequisites

- Node.js
- npm
- Git

### Clone the Repository

```bash
git clone https://github.com/poojahossur/SmartMed.git
cd SmartMed
```

### Install Dependencies

```bash
npm install
```

---

## Environment Variables

Create a `.env` file in the project root.

```env
GEMINI_API_KEY=your_gemini_api_key

TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number

FIREBASE_SERVICE_ACCOUNT_JSON=your_firebase_service_account_credentials
```

Never commit API keys, authentication tokens, Firebase service-account credentials, or `.env` files to GitHub.

For deployment, configure these values through the hosting platform's environment-variable settings.

---

## Running Locally

Start the development server:

```bash
npm run dev
```

The application will normally be available at:

```text
http://localhost:3000
```

The port may vary depending on the environment.

---

## Production Build

Create a production build with:

```bash
npm run build
```

---

## Deployment

SmartMed is deployed using Render.

```text
GitHub
   |
   v
Render
   |
   v
SmartMed Application
   |
   +----------+----------+
   |          |          |
Firebase   Gemini     Twilio
```

Production credentials are configured through Render environment variables and are not stored in the GitHub repository.

---

## Twilio Trial Account

The current live demonstration uses a Twilio Trial account.

As a result, outbound voice calls may begin with a Twilio trial-account notification before the SmartMed medication reminder is played.

This message is generated by Twilio and is not part of the SmartMed application.

Trial accounts may also require recipient phone-number verification and may have usage restrictions.

For production usage, a fully configured Twilio account would be required.

---

## Medical Safety Disclaimer

SmartMed is a medication management and healthcare assistance platform. It is not intended to diagnose medical conditions, prescribe medication, replace professional medical advice, or independently recommend medication changes.

AI-generated information may be incomplete or inaccurate. Medication names, dosages, substitutions, and treatment decisions should be verified with a qualified healthcare professional.

---

## Future Enhancements

- Multilingual voice and SMS reminders
- Dedicated mobile application
- Advanced medication adherence prediction
- Enhanced caregiver dashboard
- Doctor and pharmacy integration
- Medication refill prediction
- Wearable device integration
- Improved accessibility and voice interaction

---

## Project Status

SmartMed is currently deployed as a functional project demonstration.

The current implementation includes:

- Firebase Authentication
- Medication management and scheduling
- Automated SMS reminders
- Automated voice reminders
- Interactive voice confirmation
- Caregiver notifications
- Firebase Firestore integration
- Gemini AI integration
- Prescription analysis
- Medicine substitution information
- Medication adherence tracking
- Healthcare discovery

---

## Author

**H Pooja**

Data Science Engineering Student  
Ballari Institute of Technology and Management

GitHub: [@poojahossur](https://github.com/poojahossur)

---

## License

This project is developed as an academic and portfolio project.
