/**
 * State Consistency Validator
 * Ensures data integrity and validates state transitions
 */

class StateValidator {
  constructor() {
    this.schemas = new Map();
    this.validationRules = new Map();
    this.stateHistory = [];
    this.maxHistorySize = 50;
  }

  /**
   * Register validation schema for entity type
   */
  registerSchema(entityType, schema) {
    this.schemas.set(entityType, schema);
  }

  /**
   * Validate entity against schema
   */
  validate(entityType, data) {
    const schema = this.schemas.get(entityType);
    if (!schema) {
      return { valid: true, errors: [] };
    }

    const errors = [];

    // Check required fields
    if (schema.required) {
      schema.required.forEach(field => {
        if (data[field] === undefined || data[field] === null || data[field] === '') {
          errors.push({
            field,
            type: 'required',
            message: `Feld "${field}" ist erforderlich`
          });
        }
      });
    }

    // Check field types
    if (schema.fields) {
      Object.entries(schema.fields).forEach(([field, rules]) => {
        const value = data[field];

        if (value === undefined || value === null) {
          return; // Skip if not required
        }

        // Type validation
        if (rules.type) {
          const actualType = Array.isArray(value) ? 'array' : typeof value;
          if (actualType !== rules.type) {
            errors.push({
              field,
              type: 'type',
              message: `Feld "${field}" muss vom Typ ${rules.type} sein`
            });
          }
        }

        // Min/Max length for strings
        if (rules.type === 'string') {
          if (rules.minLength && value.length < rules.minLength) {
            errors.push({
              field,
              type: 'minLength',
              message: `Feld "${field}" muss mindestens ${rules.minLength} Zeichen lang sein`
            });
          }
          if (rules.maxLength && value.length > rules.maxLength) {
            errors.push({
              field,
              type: 'maxLength',
              message: `Feld "${field}" darf maximal ${rules.maxLength} Zeichen lang sein`
            });
          }
        }

        // Min/Max for numbers
        if (rules.type === 'number') {
          if (rules.min !== undefined && value < rules.min) {
            errors.push({
              field,
              type: 'min',
              message: `Feld "${field}" muss mindestens ${rules.min} sein`
            });
          }
          if (rules.max !== undefined && value > rules.max) {
            errors.push({
              field,
              type: 'max',
              message: `Feld "${field}" darf maximal ${rules.max} sein`
            });
          }
        }

        // Enum validation
        if (rules.enum && !rules.enum.includes(value)) {
          errors.push({
            field,
            type: 'enum',
            message: `Feld "${field}" muss einer der folgenden Werte sein: ${rules.enum.join(', ')}`
          });
        }

        // Pattern validation
        if (rules.pattern && !rules.pattern.test(value)) {
          errors.push({
            field,
            type: 'pattern',
            message: rules.patternMessage || `Feld "${field}" hat ein ungültiges Format`
          });
        }

        // Custom validation
        if (rules.validate && typeof rules.validate === 'function') {
          const customError = rules.validate(value, data);
          if (customError) {
            errors.push({
              field,
              type: 'custom',
              message: customError
            });
          }
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate state transition
   */
  validateTransition(entityType, fromState, toState, allowedTransitions) {
    if (!allowedTransitions[fromState]) {
      return {
        valid: false,
        error: `Ungültiger Ausgangsstatus: ${fromState}`
      };
    }

    if (!allowedTransitions[fromState].includes(toState)) {
      return {
        valid: false,
        error: `Übergang von "${fromState}" zu "${toState}" ist nicht erlaubt`
      };
    }

    return { valid: true };
  }

  /**
   * Check data consistency
   */
  checkConsistency(entityType, data, relatedData = {}) {
    const issues = [];

    // Task-specific consistency checks
    if (entityType === 'task') {
      // Check if assignee exists
      if (data.assignee && relatedData.users) {
        const userExists = relatedData.users.some(u => u.id === data.assignee || u.name === data.assignee);
        if (!userExists) {
          issues.push({
            type: 'referential-integrity',
            message: `Zugewiesener Benutzer "${data.assignee}" existiert nicht`
          });
        }
      }

      // Check date logic
      if (data.startDate && data.dueDate) {
        const start = new Date(data.startDate);
        const due = new Date(data.dueDate);
        if (start > due) {
          issues.push({
            type: 'logic-error',
            message: 'Startdatum darf nicht nach Fälligkeitsdatum liegen'
          });
        }
      }

      // Check if done tasks have completion date
      if (data.status === 'done' && !data.completedAt) {
        issues.push({
            type: 'data-integrity',
          message: 'Erledigte Aufgaben sollten ein Abschlussdatum haben'
        });
      }
    }

    // Message-specific checks
    if (entityType === 'message') {
      if (data.sender_id === data.receiver_id) {
        issues.push({
          type: 'logic-error',
          message: 'Sender und Empfänger dürfen nicht identisch sein'
        });
      }
    }

    return {
      consistent: issues.length === 0,
      issues
    };
  }

  /**
   * Sanitize input data
   */
  sanitize(entityType, data) {
    const sanitized = { ...data };

    // Remove undefined and null values
    Object.keys(sanitized).forEach(key => {
      if (sanitized[key] === undefined) {
        delete sanitized[key];
      }
    });

    // Trim strings
    Object.keys(sanitized).forEach(key => {
      if (typeof sanitized[key] === 'string') {
        sanitized[key] = sanitized[key].trim();
      }
    });

    // Entity-specific sanitization
    if (entityType === 'message') {
      // Remove script tags from messages
      if (sanitized.message) {
        sanitized.message = sanitized.message
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
      }
    }

    if (entityType === 'task') {
      // Ensure tags is always an array
      if (sanitized.tags && !Array.isArray(sanitized.tags)) {
        sanitized.tags = [sanitized.tags];
      }

      // Convert priority to lowercase
      if (sanitized.priority) {
        sanitized.priority = sanitized.priority.toLowerCase();
      }
    }

    return sanitized;
  }

  /**
   * Record state change for history
   */
  recordStateChange(entityType, entityId, oldState, newState, userId) {
    const change = {
      entityType,
      entityId,
      oldState: JSON.stringify(oldState),
      newState: JSON.stringify(newState),
      userId,
      timestamp: new Date().toISOString(),
      changes: this.detectChanges(oldState, newState)
    };

    this.stateHistory.push(change);

    // Limit history size
    if (this.stateHistory.length > this.maxHistorySize) {
      this.stateHistory.shift();
    }

    return change;
  }

  /**
   * Detect what changed between states
   */
  detectChanges(oldState, newState) {
    const changes = [];

    const allKeys = new Set([
      ...Object.keys(oldState || {}),
      ...Object.keys(newState || {})
    ]);

    allKeys.forEach(key => {
      const oldValue = oldState?.[key];
      const newValue = newState?.[key];

      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes.push({
          field: key,
          oldValue,
          newValue
        });
      }
    });

    return changes;
  }

  /**
   * Get state history for entity
   */
  getHistory(entityType, entityId) {
    return this.stateHistory.filter(
      change => change.entityType === entityType && change.entityId === entityId
    );
  }

  /**
   * Rollback to previous state
   */
  rollback(entityType, entityId, steps = 1) {
    const history = this.getHistory(entityType, entityId);
    if (history.length < steps) {
      return null;
    }

    const targetChange = history[history.length - steps];
    return JSON.parse(targetChange.oldState);
  }

  /**
   * Clear history
   */
  clearHistory(entityType, entityId) {
    if (entityType && entityId) {
      this.stateHistory = this.stateHistory.filter(
        change => !(change.entityType === entityType && change.entityId === entityId)
      );
    } else {
      this.stateHistory = [];
    }
  }

  /**
   * Get validation summary
   */
  getSummary() {
    return {
      registeredSchemas: Array.from(this.schemas.keys()),
      historySize: this.stateHistory.length,
      maxHistorySize: this.maxHistorySize
    };
  }
}

// Singleton instance
const stateValidator = new StateValidator();

// Register default schemas
stateValidator.registerSchema('task', {
  required: ['title', 'status'],
  fields: {
    title: {
      type: 'string',
      minLength: 1,
      maxLength: 200
    },
    description: {
      type: 'string',
      maxLength: 2000
    },
    status: {
      type: 'string',
      enum: ['todo', 'inprogress', 'review', 'done']
    },
    priority: {
      type: 'string',
      enum: ['low', 'medium', 'high']
    },
    assignee: {
      type: 'string',
      maxLength: 100
    },
    tags: {
      type: 'array'
    }
  }
});

stateValidator.registerSchema('message', {
  required: ['message', 'sender_id', 'receiver_id'],
  fields: {
    message: {
      type: 'string',
      minLength: 1,
      maxLength: 5000
    },
    sender_id: {
      type: 'number',
      validate: (value) => {
        if (value <= 0) return 'Ungültige Sender-ID';
        return null;
      }
    },
    receiver_id: {
      type: 'number',
      validate: (value) => {
        if (value <= 0) return 'Ungültige Empfänger-ID';
        return null;
      }
    },
    message_type: {
      type: 'string',
      enum: ['text', 'gif', 'file']
    }
  }
});

// Task state transitions
const TASK_TRANSITIONS = {
  'todo': ['inprogress', 'done'],
  'inprogress': ['review', 'todo', 'done'],
  'review': ['inprogress', 'done', 'todo'],
  'done': ['todo', 'inprogress']
};

export { TASK_TRANSITIONS };
export default stateValidator;
