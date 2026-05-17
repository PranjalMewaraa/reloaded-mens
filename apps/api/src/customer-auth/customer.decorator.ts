import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export interface AuthedCustomer {
  id: string;
  phone: string;
  email: string | null;
}

export const Customer = createParamDecorator<unknown, ExecutionContext, AuthedCustomer>(
  (_data, ctx) => {
    const req = ctx.switchToHttp().getRequest<Request & { customer?: AuthedCustomer }>();
    if (!req.customer) {
      throw new Error('Customer decorator used on an unguarded route');
    }
    return req.customer;
  },
);
