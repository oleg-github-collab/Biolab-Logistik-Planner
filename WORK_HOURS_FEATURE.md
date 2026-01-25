# Work Hours Editing Feature

## Location
The work hours editing feature is located in the **User Profile** page.

## How to Access
1. Click on your profile photo or name in the header
2. Navigate to your profile settings
3. Scroll down to the **"Arbeitszeiten"** (Work Hours) section

## Features
- **Employment Type** (Beschäftigungsart): Switch between Werkstudent and Vollzeit
- **Weekly Hours Quota** (Wöchentliche Stunden): Adjust your working hours per week

## Validation Rules
- **Werkstudent**: 
  - During semester: max 20 hours recommended
  - During holidays: up to 40 hours allowed
  - You will get a warning if you set more than 40 hours
  
- **Vollzeit**: Standard 40 hours per week

## Use Cases
- **Example**: A Werkstudent working 12 hours during semester can easily change to 15 hours or 20 hours for the summer
- **auto_schedule** field automatically updates based on employment type:
  - Vollzeit → auto_schedule = true
  - Werkstudent → auto_schedule = false

## Files Modified
- `client/src/components/UserProfile.js` - Frontend UI
- `server/routes/userProfile.pg.js` - Backend API with validation

## API Endpoint
- PUT `/api/profile/:userId` - Updates profile including work hours
  - Requires authentication
  - Users can only edit their own profile
