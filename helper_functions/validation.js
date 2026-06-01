// utils/validateSignupInput.js
const validator = require("validator");

function validateSignupInput(data, isEditMode = false) {
  const errors = [];

  const {
    firstname,
    lastname,
    email,
    Pass,
    phone,
    address,
    city,
    zip,
  } = data;

  const nameRegex = /^[A-Za-z]+$/;
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,128}$/;
  const phoneRegex = /^\d{11}$/;
  const cityRegex = /^[A-Za-z]{5,15}$/;
  const zipRegex = /^\d{4}$/;

  const disposableDomains = ["mailinator.com", "10minutemail.com", "guerrillamail.com"];
  const domain = email.split("@")[1];

  // ✨ Validate everything
  if (!email || !validator.isEmail(email)) {
    errors.push("❌ Invalid email format.");
  } else if (disposableDomains.includes(domain)) {
    errors.push("🚫 Disposable email addresses not allowed.");
  }

  if (!nameRegex.test(firstname) || !nameRegex.test(lastname)) {
    errors.push("❌ First and last name must contain only alphabets.");
  }

  

  if (!isEditMode || (Pass && Pass.trim() !== "")) {
    if (!passwordRegex.test(Pass)) {
      errors.push("❌ Password must be 8-128 characters and include uppercase, lowercase, number, and symbol.");
    }
  }

  if (!address || address.trim().length < 13) {
    errors.push("❌ Address must be greater than 12 characters.");
  }

  if (!phoneRegex.test(phone)) {
    errors.push("❌ Phone must be exactly 11 digits (no symbols).");
  }

  if (!cityRegex.test(city)) {
    errors.push("❌ City must be only alphabets, 5–15 characters.");
  }

  if (!zipRegex.test(zip)) {
    errors.push("❌ Zip must be exactly 4 digits.");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

module.exports = validateSignupInput;
