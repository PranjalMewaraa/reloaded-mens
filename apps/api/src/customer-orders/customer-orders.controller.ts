import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { paginationSchema, type Pagination } from '@repo/types';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import {
  Customer,
  type AuthedCustomer,
} from '../customer-auth/customer.decorator.js';
import { CustomerAuthGuard } from '../customer-auth/customer-auth.guard.js';
import { CustomerOrdersService } from './customer-orders.service.js';

@Controller('customer-orders')
@UseGuards(CustomerAuthGuard)
export class CustomerOrdersController {
  constructor(private readonly orders: CustomerOrdersService) {}

  @Get()
  async list(
    @Customer() customer: AuthedCustomer,
    @Query(new ZodValidationPipe(paginationSchema)) query: Pagination,
  ) {
    return this.orders.list(customer.id, query);
  }

  @Get(':orderNumber')
  async getOne(
    @Customer() customer: AuthedCustomer,
    @Param('orderNumber') orderNumber: string,
  ) {
    return this.orders.getOrderForCustomer(customer.id, orderNumber);
  }
}
