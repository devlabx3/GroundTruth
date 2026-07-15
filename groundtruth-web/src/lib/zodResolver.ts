/**
 * Resolver Zod → react-hook-form sin @hookform/resolvers (una dependencia menos).
 * Los `message` del esquema son CLAVES i18n (regla: ningún texto en código);
 * la vista los traduce al renderizar (ErrorInline).
 */
import type { FieldError, FieldValues, Resolver } from 'react-hook-form';
import type { ZodType } from 'zod';

export function zodResolver<T extends FieldValues>(schema: ZodType<T>): Resolver<T> {
  return (values) => {
    const result = schema.safeParse(values);
    if (result.success) return { values: result.data, errors: {} };
    const errors: Record<string, FieldError> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.join('.') || 'root';
      // El PRIMER error de cada campo gana: es el que la vista muestra.
      if (!errors[path]) errors[path] = { type: issue.code, message: issue.message };
    }
    return { values: {}, errors } as ReturnType<Resolver<T>>;
  };
}
