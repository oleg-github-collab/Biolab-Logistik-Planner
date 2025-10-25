import { useState } from 'react';

/**
 * Custom hook for form validation
 * @param {Object} initialValues - Initial form values
 * @param {Object} validationRules - Validation rules for each field
 * @returns {Object} Form state and handlers
 */
export const useFormValidation = (initialValues, validationRules) => {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Validate a single field
   * @param {string} fieldName - Name of the field to validate
   * @param {*} value - Value to validate
   * @returns {string|null} Error message or null if valid
   */
  const validate = (fieldName, value) => {
    const rules = validationRules[fieldName];
    if (!rules) return null;

    for (const rule of rules) {
      const error = rule(value, values);
      if (error) return error;
    }
    return null;
  };

  /**
   * Handle field value change
   * @param {string} name - Field name
   * @param {*} value - New value
   */
  const handleChange = (name, value) => {
    setValues(prev => ({ ...prev, [name]: value }));

    // Validate on change if field was already touched
    if (touched[name]) {
      const error = validate(name, value);
      setErrors(prev => ({ ...prev, [name]: error }));
    }
  };

  /**
   * Handle field blur event
   * @param {string} name - Field name
   */
  const handleBlur = (name) => {
    setTouched(prev => ({ ...prev, [name]: true }));
    const error = validate(name, values[name]);
    setErrors(prev => ({ ...prev, [name]: error }));
  };

  /**
   * Validate all fields
   * @returns {boolean} True if form is valid
   */
  const validateAll = () => {
    const newErrors = {};
    const newTouched = {};

    Object.keys(validationRules).forEach(key => {
      newTouched[key] = true;
      const error = validate(key, values[key]);
      if (error) newErrors[key] = error;
    });

    setErrors(newErrors);
    setTouched(newTouched);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Reset form to initial values
   */
  const reset = () => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
    setIsSubmitting(false);
  };

  /**
   * Set form values programmatically
   * @param {Object} newValues - New values to set
   */
  const setFormValues = (newValues) => {
    setValues(newValues);
  };

  /**
   * Set a single field error
   * @param {string} field - Field name
   * @param {string} error - Error message
   */
  const setFieldError = (field, error) => {
    setErrors(prev => ({ ...prev, [field]: error }));
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  return {
    values,
    errors,
    touched,
    isSubmitting,
    handleChange,
    handleBlur,
    validateAll,
    reset,
    setValues: setFormValues,
    setFieldError,
    setIsSubmitting
  };
};

// ============================================
// Common Validation Rules
// ============================================

/**
 * Required field validation
 * @param {string} message - Custom error message
 * @returns {Function} Validation function
 */
export const required = (message = 'Dieses Feld ist erforderlich') => (value) => {
  if (value === null || value === undefined) return message;
  if (typeof value === 'string' && value.trim() === '') return message;
  if (Array.isArray(value) && value.length === 0) return message;
  return null;
};

/**
 * Minimum length validation
 * @param {number} min - Minimum length
 * @param {string} message - Custom error message
 * @returns {Function} Validation function
 */
export const minLength = (min, message) => (value) => {
  if (!value) return null; // Skip if empty (use required() for that)
  return value.length < min ? (message || `Mindestens ${min} Zeichen erforderlich`) : null;
};

/**
 * Maximum length validation
 * @param {number} max - Maximum length
 * @param {string} message - Custom error message
 * @returns {Function} Validation function
 */
export const maxLength = (max, message) => (value) => {
  if (!value) return null;
  return value.length > max ? (message || `Maximal ${max} Zeichen erlaubt`) : null;
};

/**
 * Email validation
 * @param {string} message - Custom error message
 * @returns {Function} Validation function
 */
export const email = (message = 'Ungültige E-Mail-Adresse') => (value) => {
  if (!value) return null;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return !emailRegex.test(value) ? message : null;
};

/**
 * URL validation
 * @param {string} message - Custom error message
 * @returns {Function} Validation function
 */
export const url = (message = 'Ungültige URL') => (value) => {
  if (!value) return null;
  try {
    new URL(value);
    return null;
  } catch {
    return message;
  }
};

/**
 * Time format validation (HH:MM)
 * @param {string} message - Custom error message
 * @returns {Function} Validation function
 */
export const timeFormat = (message = 'Ungültiges Zeitformat (HH:MM erforderlich)') => (value) => {
  if (!value) return null;
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  return !timeRegex.test(value) ? message : null;
};

/**
 * Date format validation (YYYY-MM-DD)
 * @param {string} message - Custom error message
 * @returns {Function} Validation function
 */
export const dateFormat = (message = 'Ungültiges Datumsformat') => (value) => {
  if (!value) return null;
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(value)) return message;

  const date = new Date(value);
  return isNaN(date.getTime()) ? message : null;
};

/**
 * Minimum number validation
 * @param {number} min - Minimum value
 * @param {string} message - Custom error message
 * @returns {Function} Validation function
 */
export const minValue = (min, message) => (value) => {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return num < min ? (message || `Wert muss mindestens ${min} sein`) : null;
};

/**
 * Maximum number validation
 * @param {number} max - Maximum value
 * @param {string} message - Custom error message
 * @returns {Function} Validation function
 */
export const maxValue = (max, message) => (value) => {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return num > max ? (message || `Wert darf höchstens ${max} sein`) : null;
};

/**
 * Number validation
 * @param {string} message - Custom error message
 * @returns {Function} Validation function
 */
export const isNumber = (message = 'Muss eine Zahl sein') => (value) => {
  if (!value && value !== 0) return null;
  return isNaN(Number(value)) ? message : null;
};

/**
 * Integer validation
 * @param {string} message - Custom error message
 * @returns {Function} Validation function
 */
export const isInteger = (message = 'Muss eine ganze Zahl sein') => (value) => {
  if (!value && value !== 0) return null;
  return !Number.isInteger(Number(value)) ? message : null;
};

/**
 * Pattern matching validation
 * @param {RegExp} pattern - Regular expression pattern
 * @param {string} message - Custom error message
 * @returns {Function} Validation function
 */
export const matches = (pattern, message = 'Ungültiges Format') => (value) => {
  if (!value) return null;
  return !pattern.test(value) ? message : null;
};

/**
 * Phone number validation (German format)
 * @param {string} message - Custom error message
 * @returns {Function} Validation function
 */
export const phoneNumber = (message = 'Ungültige Telefonnummer') => (value) => {
  if (!value) return null;
  // Accept various German phone formats
  const phoneRegex = /^[\d\s\-\+\(\)]+$/;
  if (!phoneRegex.test(value)) return message;

  // Check if it has enough digits
  const digits = value.replace(/\D/g, '');
  return digits.length < 6 ? message : null;
};

/**
 * Comparison validation (e.g., password confirmation)
 * @param {string} fieldName - Name of field to compare with
 * @param {string} message - Custom error message
 * @returns {Function} Validation function
 */
export const sameAs = (fieldName, message) => (value, allValues) => {
  if (!value) return null;
  return value !== allValues[fieldName] ? (message || `Muss mit ${fieldName} übereinstimmen`) : null;
};

/**
 * Date range validation (start date before end date)
 * @param {string} endDateField - Name of end date field
 * @param {string} message - Custom error message
 * @returns {Function} Validation function
 */
export const beforeDate = (endDateField, message = 'Startdatum muss vor Enddatum liegen') => (value, allValues) => {
  if (!value || !allValues[endDateField]) return null;
  const startDate = new Date(value);
  const endDate = new Date(allValues[endDateField]);
  return startDate >= endDate ? message : null;
};

/**
 * Date range validation (end date after start date)
 * @param {string} startDateField - Name of start date field
 * @param {string} message - Custom error message
 * @returns {Function} Validation function
 */
export const afterDate = (startDateField, message = 'Enddatum muss nach Startdatum liegen') => (value, allValues) => {
  if (!value || !allValues[startDateField]) return null;
  const endDate = new Date(value);
  const startDate = new Date(allValues[startDateField]);
  return endDate <= startDate ? message : null;
};

/**
 * Time range validation (start time before end time)
 * @param {string} endTimeField - Name of end time field
 * @param {string} message - Custom error message
 * @returns {Function} Validation function
 */
export const beforeTime = (endTimeField, message = 'Startzeit muss vor Endzeit liegen') => (value, allValues) => {
  if (!value || !allValues[endTimeField]) return null;
  return value >= allValues[endTimeField] ? message : null;
};

/**
 * Time range validation (end time after start time)
 * @param {string} startTimeField - Name of start time field
 * @param {string} message - Custom error message
 * @returns {Function} Validation function
 */
export const afterTime = (startTimeField, message = 'Endzeit muss nach Startzeit liegen') => (value, allValues) => {
  if (!value || !allValues[startTimeField]) return null;
  return value <= allValues[startTimeField] ? message : null;
};

/**
 * Password strength validation
 * @param {string} message - Custom error message
 * @returns {Function} Validation function
 */
export const strongPassword = (message = 'Passwort muss mindestens 8 Zeichen, einen Großbuchstaben, eine Zahl und ein Sonderzeichen enthalten') => (value) => {
  if (!value) return null;
  const hasMinLength = value.length >= 8;
  const hasUpperCase = /[A-Z]/.test(value);
  const hasLowerCase = /[a-z]/.test(value);
  const hasNumber = /\d/.test(value);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(value);

  return hasMinLength && hasUpperCase && hasLowerCase && hasNumber && hasSpecialChar ? null : message;
};

/**
 * Custom validation function
 * @param {Function} validatorFn - Custom validator function (value, allValues) => error | null
 * @returns {Function} Validation function
 */
export const custom = (validatorFn) => validatorFn;

/**
 * Conditional validation - only validate if condition is met
 * @param {Function} condition - Function to check condition (allValues) => boolean
 * @param {Function} validator - Validation function to apply if condition is true
 * @returns {Function} Validation function
 */
export const when = (condition, validator) => (value, allValues) => {
  return condition(allValues) ? validator(value, allValues) : null;
};

export default useFormValidation;
