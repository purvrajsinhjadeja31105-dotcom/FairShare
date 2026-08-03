# Implementation Plan: Dynamic UPI QR Code Payments

This plan details the integration of dynamic UPI QR code generation into the settlement flow. Users will be able to save their UPI ID in their profiles, and others can scan dynamically generated QR codes to pay them instantly during settlements.

---

## User Review Required

> [!IMPORTANT]
> **UPI Payment Protocol:**
   * UPI payments are processed on mobile devices using deep-linking protocols (`upi://pay`).
   * The generated QR code will translate standard UPI intents recognizable by Google Pay, PhonePe, Paytm, and BHIM apps.
   * Since there is no bank webhook integration, the payment itself happens securely outside the app. The user will still click "Confirm Settlement" inside the app once the transfer is successful.

---

## Proposed Changes

### Component 1: Database & Backend User profile Updates
To generate a personalized QR code for a user, the app must store their UPI ID.

#### [MODIFY] [users.js](file:///c:/CODING/Wed%20development/SplitWise/backend/routes/users.js)
* **Modify `PUT /profile` (or add `PUT /profile/upi`):**
  * Update the user document in Firestore to support saving/updating a `upi_id` field.
  * Validate the input UPI ID using a basic regex (e.g. `^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$`).

---

### Component 2: Frontend Profile Settings
Allow users to enter and save their UPI ID.

#### [MODIFY] [Dashboard.jsx](file:///c:/CODING/Wed%20development/SplitWise/frontend/src/pages/Dashboard.jsx)
* Add a profile settings button or inline input widget near the user header so they can save/update their UPI ID easily.
* Keep the local storage user profile sync (`fairshare_user`) updated with the new `upi_id`.

---

### Component 3: Frontend Settlement QR Code Rendering
Render the dynamic payment code inside the Group Details Settlement modal.

#### [MODIFY] [GroupView.jsx](file:///c:/CODING/Wed%20development/SplitWise/frontend/src/pages/GroupView.jsx)
* Install `qrcode.react` package in the frontend workspace.
* Update `GroupView.jsx` **Settlement Modal**:
  * Check if the target member (who is owed money) has a `upi_id`.
  * If yes, render the QR code using `<QRCodeSVG>` targeting the standard UPI URI:
    `upi://pay?pa={upiId}&pn={userName}&am={amount}&cu=INR&tn=FairShare%20Settlement`
  * If no, show a message: *"Recipient has not set their UPI ID yet"* and provide an option to manually enter their UPI ID to generate the QR code instantly.

---

## Verification Plan

### Automated Tests
* We will check that the frontend production bundle builds successfully after installing `qrcode.react`.

### Manual Verification
1. Log in as **User B** and set a test UPI ID (e.g., `userb@okaxis`) in the profile section.
2. Log in as **User A**, navigate to the group details page where you owe **User B** ₹250.
3. Click the **"Quick Settle Up"** button.
4. Verify that the settlement modal generates and displays a QR code.
5. Scan the QR code using a UPI app (like GPay or Paytm) on a mobile phone.
6. Verify that the UPI app correctly reads the payee name (**User B**), UPI address (`userb@okaxis`), and prepopulates the exact amount (₹250).
