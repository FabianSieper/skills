import { createHash } from 'node:crypto';
import { AutomationError } from './errors.ts';

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type Value = string | number | boolean | string[];
export type Input = Record<string, Value>;
export interface Field {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'string[]';
  description: string;
  required?: boolean;
  default?: Value;
  min?: number;
  max?: number;
  enum?: string[];
}
export type Fields = Record<string, Field>;
export function validateInput(fields: Fields, raw: unknown): Input {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new AutomationError('INVALID_INPUT');
  const record = raw as Record<string, unknown>;
  if (Object.keys(record).some(k => !Object.hasOwn(fields, k))) throw new AutomationError('INVALID_INPUT');
  const result: Input = Object.create(null) as Input;
  for (const [key, field] of Object.entries(fields)) {
    const value = Object.hasOwn(record, key) ? record[key] : field.default;
    if (value === undefined) {
      if (field.required) throw new AutomationError('INVALID_INPUT');
      continue;
    }
    let valid = false;
    switch (field.type) {
      case 'string': valid = typeof value === 'string'; break;
      case 'boolean': valid = typeof value === 'boolean'; break;
      case 'number': valid = typeof value === 'number' && Number.isFinite(value); break;
      case 'integer': valid = typeof value === 'number' && Number.isSafeInteger(value); break;
      case 'string[]': valid = Array.isArray(value) && value.every(v => typeof v === 'string'); break;
    }
    if (!valid) throw new AutomationError('INVALID_INPUT');
    const metric = typeof value === 'string' || Array.isArray(value) ? value.length : value;
    if (typeof metric === 'number' && ((field.min !== undefined && metric < field.min) ||
        (field.max !== undefined && metric > field.max))) throw new AutomationError('INVALID_INPUT');
    if (field.enum && (typeof value !== 'string' || !field.enum.includes(value)))
      throw new AutomationError('INVALID_INPUT');
    result[key] = Array.isArray(value) ? [...value] as string[] : value as Value;
  }
  return result;
}
export function jsonValue(value: unknown, seen = new Set<object>()): Json {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'object' || value === null || seen.has(value))
    throw new AutomationError('POSTCONDITION_FAILED');
  if (!Array.isArray(value) && ![Object.prototype, null].includes(Object.getPrototypeOf(value)))
    throw new AutomationError('POSTCONDITION_FAILED');
  seen.add(value);
  let result: Json;
  if (Array.isArray(value)) result = value.map(v => jsonValue(v, seen));
  else result = Object.fromEntries(Object.entries(value).map(([k,v]) => [k, jsonValue(v, seen)]));
  seen.delete(value);
  return result;
}
export function canonical(value: Json): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value !== null && typeof value === 'object') return '{' + Object.keys(value).sort()
    .map(k => JSON.stringify(k) + ':' + canonical(value[k]!)).join(',') + '}';
  return JSON.stringify(value);
}
export function digest(value: unknown): string {
  return createHash('sha256').update(canonical(jsonValue(value))).digest('hex');
}
