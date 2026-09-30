import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { JwtModule } from '@nestjs/jwt'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { CoreModule } from './common/core.module'
import { ConfigService } from './common/config.service'
import { AuthGuard, RolesGuard } from './common/guards'
import { HealthModule } from './modules/health/health.module'
import { AuthModule } from './modules/auth/auth.module'
import { UsersModule } from './modules/users/users.module'
import { SellersModule } from './modules/sellers/sellers.module'
import { StoresModule } from './modules/stores/stores.module'
import { CatalogModule } from './modules/catalog/catalog.module'
import { ProductsModule } from './modules/products/products.module'
import { InventoryModule } from './modules/inventory/inventory.module'
import { SearchModule } from './modules/search/search.module'
import { CartModule } from './modules/cart/cart.module'
import { CheckoutModule } from './modules/checkout/checkout.module'
import { OrdersModule } from './modules/orders/orders.module'
import { ReservationsModule } from './modules/reservations/reservations.module'
import { FulfillmentModule } from './modules/fulfillment/fulfillment.module'
import { DeliveryModule } from './modules/delivery/delivery.module'
import { PaymentsModule } from './modules/payments/payments.module'
import { ReviewsModule } from './modules/reviews/reviews.module'
import { WishlistModule } from './modules/wishlist/wishlist.module'
import { NotificationsModule } from './modules/notifications/notifications.module'
import { CouponsModule } from './modules/coupons/coupons.module'
import { AiModule } from './modules/ai/ai.module'
import { AdminModule } from './modules/admin/admin.module'
import { ReturnsModule } from './modules/returns/returns.module'


@Module({
  imports: [
    CoreModule.forRoot(),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.env.AUTH_SECRET,
        signOptions: { expiresIn: config.env.JWT_ACCESS_TTL },
      }),
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    HealthModule,
    AuthModule,
    UsersModule,
    SellersModule,
    StoresModule,
    CatalogModule,
    ProductsModule,
    InventoryModule,
    SearchModule,
    CartModule,
    CheckoutModule,
    OrdersModule,
    ReservationsModule,
    FulfillmentModule,
    DeliveryModule,
    PaymentsModule,
    ReviewsModule,
    WishlistModule,
    NotificationsModule,
    CouponsModule,
    AiModule,
    AdminModule,
    ReturnsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
