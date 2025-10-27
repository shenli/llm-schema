import type {
  AnyFieldDefinition,
  ArrayFieldDefinition,
  BooleanFieldDefinition,
  DateFieldDefinition,
  EntityFieldDefinition,
  EnumFieldDefinition,
  MarkdownFieldDefinition,
  NumberFieldDefinition,
  ObjectFieldDefinition,
  TextFieldDefinition
} from './types';

export function isTextField(field: AnyFieldDefinition): field is TextFieldDefinition<boolean> {
  return field.kind === 'text';
}

export function isMarkdownField(field: AnyFieldDefinition): field is MarkdownFieldDefinition<boolean> {
  return field.kind === 'markdown';
}

export function isNumberField(field: AnyFieldDefinition): field is NumberFieldDefinition<boolean> {
  return field.kind === 'number';
}

export function isBooleanField(field: AnyFieldDefinition): field is BooleanFieldDefinition<boolean> {
  return field.kind === 'boolean';
}

export function isDateField(field: AnyFieldDefinition): field is DateFieldDefinition<boolean> {
  return field.kind === 'date';
}

export function isEnumField(field: AnyFieldDefinition): field is EnumFieldDefinition<readonly string[], boolean> {
  return field.kind === 'enum';
}

export function isEntityField(field: AnyFieldDefinition): field is EntityFieldDefinition<string, boolean> {
  return field.kind === 'entity';
}

export function isArrayField(field: AnyFieldDefinition): field is ArrayFieldDefinition<any, boolean> {
  return field.kind === 'array';
}

export function isObjectField(field: AnyFieldDefinition): field is ObjectFieldDefinition<any, boolean> {
  return field.kind === 'object';
}
