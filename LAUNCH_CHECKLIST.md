# SmartMed launch checklist

## 1. Install and validate

```powershell
npm install
npm run lint
npm run build
```

## 2. Environment

Create `.env` beside `package.json`:

```env
GEMINI_API_KEY=...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=...
```

Do not add `VITE_GEMINI_API_KEY`. Gemini is called from the server.

## 3. AI Medicine Scanner

- Open the AI Medicine Scanner.
- Use **Take Photo** on a phone or a webcam-enabled device.
- Or use **Upload**.
- Analyze the medicine/package.
- Verify the detected medicine, strength and form.
- Select **Review Safer Substitution**.
- Treat the result as information only; do not change a prescribed medicine without a clinician/pharmacist.

## 4. Prescription Scanner

- Use **Take Photo** or **Upload**.
- Review every extracted medicine.
- Correct uncertain handwriting manually.
- Confirm the prescription.
- The app saves the medicines and creates scheduled dose records for the stated duration (up to 365 days).
- Existing SmartMed reminder/Twilio code continues to handle due doses.

## 5. Doctor Report

- Select 7, 30 or 90 days.
- Generate the report.
- Verify that the statistics reflect stored dose records.
- Use **Print / Save as PDF**.

## 6. Camera

Browser camera access requires permission. On a deployed site, use HTTPS. `localhost` is allowed for development.

## 7. Existing features

Firebase, Twilio, Healthcare Finder, authentication and the existing medication dashboard are preserved.
