import { Body, Controller, Module, Post } from '@nestjs/common'
import { couponValidateSchema } from '@nearbuy/validation'
import type { z } from 'zod'
import { PrismaService } from '../../common/core.module'
import { ZodValidationPipe } from '../../common/errors'
import { applyCoupon } from './coupon-rules'


type CouponInput = z.infer<typeof couponValidateSchema>

@Controller('coupons')
export class CouponsController {
  constructor(private readonly prisma: PrismaService) {}

  /** Validate a coupon server-side before any totals are trusted. */
  @Post('validate')
  validate(@Body(new ZodValidationPipe(couponValidateSchema)) body: CouponInput) {
    return applyCoupon(this.prisma, body)
  }
}

@Module({ controllers: [CouponsController] })
export class CouponsModule {}
