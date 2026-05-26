function valueType(value) {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  if (Number.isInteger(value)) return "integer";
  return typeof value;
}

function matchesType(expected, value) {
  const actual = valueType(value);

  if (Array.isArray(expected)) {
    return expected.some((item) => matchesType(item, value));
  }

  if (expected === "number") {
    return actual === "number" || actual === "integer";
  }

  return actual === expected;
}

function validateFormat(format, value) {
  if (format === "uri") {
    try {
      new URL(value);
      return true;
    } catch (_err) {
      return false;
    }
  }

  if (format === "date-time") {
    return !Number.isNaN(Date.parse(value));
  }

  return true;
}

function push(errors, path, message) {
  errors.push(`${path}: ${message}`);
}

function validate(schema, value, path = "$", errors = []) {
  if (schema.const !== undefined && value !== schema.const) {
    push(errors, path, `expected const ${JSON.stringify(schema.const)}`);
    return errors;
  }

  if (schema.type && !matchesType(schema.type, value)) {
    push(errors, path, `expected type ${JSON.stringify(schema.type)}, got ${valueType(value)}`);
    return errors;
  }

  if (schema.enum && !schema.enum.includes(value)) {
    push(errors, path, `expected one of ${schema.enum.join(", ")}`);
  }

  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      push(errors, path, `expected minLength ${schema.minLength}`);
    }

    if (schema.pattern && !(new RegExp(schema.pattern).test(value))) {
      push(errors, path, `does not match pattern ${schema.pattern}`);
    }

    if (schema.format && !validateFormat(schema.format, value)) {
      push(errors, path, `invalid ${schema.format}`);
    }
  }

  if ((typeof value === "number" || Number.isInteger(value)) && schema.minimum !== undefined && value < schema.minimum) {
    push(errors, path, `expected minimum ${schema.minimum}`);
  }

  if ((typeof value === "number" || Number.isInteger(value)) && schema.maximum !== undefined && value > schema.maximum) {
    push(errors, path, `expected maximum ${schema.maximum}`);
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      push(errors, path, `expected minItems ${schema.minItems}`);
    }

    if (schema.items) {
      value.forEach((item, index) => validate(schema.items, item, `${path}[${index}]`, errors));
    }
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    const required = schema.required || [];
    required.forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(value, key)) {
        push(errors, `${path}.${key}`, "is required");
      }
    });

    const properties = schema.properties || {};
    Object.entries(value).forEach(([key, child]) => {
      const childSchema = properties[key];

      if (!childSchema) {
        if (schema.additionalProperties === false) {
          push(errors, `${path}.${key}`, "is not allowed");
        }
        return;
      }

      validate(childSchema, child, `${path}.${key}`, errors);
    });
  }

  return errors;
}

function assertValid(schema, value, label) {
  const errors = validate(schema, value);

  if (errors.length) {
    const err = new Error(`${label} failed contract validation:\n${errors.join("\n")}`);
    err.validationErrors = errors;
    throw err;
  }
}

module.exports = {
  assertValid,
  validate
};

