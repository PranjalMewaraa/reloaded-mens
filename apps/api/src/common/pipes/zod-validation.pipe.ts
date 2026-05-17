import { BadRequestException, PipeTransform } from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';

// Generic Zod pipe. Usage:
//   @UsePipes(new ZodValidationPipe(loginRequestSchema))
//   @Body() body: LoginRequest
// Or via @Body(new ZodValidationPipe(schema)).
// Throws 400 with a flat list of { path, message } on failure.
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'ValidationError',
        issues: formatIssues(result.error),
      });
    }
    return result.data;
  }
}

function formatIssues(error: ZodError) {
  return error.issues.map((i) => ({
    path: i.path.join('.'),
    message: i.message,
  }));
}
