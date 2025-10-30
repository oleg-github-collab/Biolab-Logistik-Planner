import de from './de';

const locales = {
  de
};

const interpolate = (template, variables = {}) =>
  template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) =>
    Object.prototype.hasOwnProperty.call(variables, key) ? variables[key] : `{{${key}}}`
  );

export const translate = (key, locale = 'de', variables = {}) => {
  const dictionary = locales[locale] || locales.de;
  const template = dictionary[key] || locales.de[key];
  if (!template) {
    return key;
  }
  if (typeof template === 'string') {
    return interpolate(template, variables);
  }
  return key;
};

export const supportedLocales = Object.keys(locales);
