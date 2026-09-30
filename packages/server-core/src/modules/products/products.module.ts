import { Body, Controller, Get, Module, Param, Patch, Post, Query } from '@nestjs/common'
import { createHash, randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { Prisma } from '@nearbuy/database'
import {
  paginationSchema,
  productCreateSchema,
  productImageSchema,
  productUpdateSchema,
} from '@nearbuy/validation'
import type { z } from 'zod'
import { PrismaService } from '../../common/core.module'
import { Errors, ZodValidationPipe } from '../../common/errors'
import { CurrentUser, Public, Roles, type AuthUser } from '../../common/guards'
import { Result, paginate } from '../../common/http'
/**
 * Products — public catalog (SEO slugs), seller CRUD, categories & brands,
 * secure image upload references (mime/size/extension validated).
 */

type ProductCreateInput = z.infer<typeof productCreateSchema>
type ProductUpdateInput = z.infer<typeof productUpdateSchema>
type ProductImageInput = z.infer<typeof productImageSchema>

const ALLOWED_IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.avif']

@Controller('products')
export class ProductsController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async list(
    @Query(new ZodValidationPipe(paginationSchema)) q: { cursor?: string; limit: number },
    @Query('category') category?: string,
    @Query('brand') brand?: string,
  ) {
    const result = await this.prisma.product
      .findMany({
        where: {
          active: true,
          ...(category ? { category: { slug: category } } : {}),
          ...(brand ? { brand: { slug: brand } } : {}),
        },
        include: { brand: true, images: true, price: true },
        orderBy: { createdAt: 'desc' },
        take: q.limit + 1,
        ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
      })
      .then((rows) => paginate(rows, q.limit))
    return new Result(result.rows, { nextCursor: result.nextCursor })
  }

  @Public()
  @Get('categories')
  categories() {
    return this.prisma.category.findMany({ include: { _count: { select: { products: true } } } })
  }

  @Public()
  @Get('brands')
  brands() {
    return this.prisma.brand.findMany({ include: { _count: { select: { products: true } } } })
  }

  @Public()
  @Get(':slug')
  async get(@Param('slug') slug: string) {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: {
        brand: true,
        category: true,
        images: { orderBy: { position: 'asc' } },
        price: true,
        variants: true,
        reviews: { take: 8, orderBy: { createdAt: 'desc' } },
      },
    })
    if (!product) throw Errors.notFound('Product not found.')
    return product
  }

  /** Seller: create product (+ base price). The listing becomes the seller's
   * to manage; public/seeded catalog rows have no owner and are admin-only. */
  @Roles('SELLER', 'ADMIN', 'SUPER_ADMIN')
  @Post()
  async create(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(productCreateSchema)) body: ProductCreateInput) {
    if (user.role !== 'SELLER') throw Errors.forbidden('Only seller accounts can list products.')
    const seller = await this.prisma.seller.findUnique({ where: { userId: user.id } })
    if (!seller) throw Errors.forbidden('Set up your store before listing products.')
    const category = await this.prisma.category.findUnique({ where: { slug: body.categorySlug } })
    if (!category) throw Errors.badRequest('Unknown category.')
    const slug = slugify(body.name)
    let brandId: string | undefined
    if (body.brandName) {
      const brand = await this.prisma.brand.upsert({
        where: { slug: slugify(body.brandName) },
        update: {},
        create: { name: body.brandName, slug: slugify(body.brandName) },
      })
      brandId = brand.id
    }
    const existing = await this.prisma.product.findUnique({ where: { slug } })
    if (existing) throw Errors.conflict('A product with this name already exists.', 'PRODUCT_EXISTS')

    return this.prisma.product.create({
      data: {
        name: body.name,
        slug,
        sku: body.sku,
        barcode: body.barcode,
        ownerId: user.id,
        brandId,
        categoryId: category.id,
        description: body.description,
        specs: body.specs as Prisma.InputJsonValue | undefined,
        tags: body.tags,
        emoji: body.emoji,
        metaTitle: `${body.name} — NearBuy`,
        metaDesc: body.description.slice(0, 155),
        price: {
          create: {
            listPrice: body.listPrice,
            mrp: body.mrp,
            onlinePrice: body.onlinePrice ?? body.listPrice,
          },
        },
      },
      include: { price: true },
    })
  }

  /** Ownership: only the seller who listed a product (or admin) may edit it.
   * Seeded/public catalog products (no owner) are admin-only. */
  private async assertCanEditProduct(user: AuthUser, productId: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId }, select: { ownerId: true } })
    if (!product) throw Errors.notFound('Product not found.')
    if (user.role === 'SELLER' && product.ownerId !== user.id) {
      throw Errors.forbidden('You can only edit products you listed.')
    }
    return product
  }

  @Roles('SELLER', 'ADMIN', 'SUPER_ADMIN')
  @Patch(':id')
  async update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodValidationPipe(productUpdateSchema)) body: ProductUpdateInput) {
    await this.assertCanEditProduct(user, id)
    return this.prisma.product.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        specs: body.specs as Prisma.InputJsonValue | undefined,
        tags: body.tags,
        emoji: body.emoji,
        active: body.active,
        price: body.listPrice
          ? {
              upsert: {
                create: {
                  listPrice: body.listPrice,
                  mrp: body.mrp ?? body.listPrice,
                  onlinePrice: body.onlinePrice ?? body.listPrice,
                },
                update: {
                  listPrice: body.listPrice,
                  mrp: body.mrp ?? body.listPrice,
                  onlinePrice: body.onlinePrice ?? body.listPrice,
                },
              },
            }
          : undefined,
      },
      include: { price: true },
    })
  }

  /** Image attach — validates extension/size/URL scheme; files go to object storage. */
  @Roles('SELLER', 'ADMIN', 'SUPER_ADMIN')
  @Post(':id/images')
  async addImage(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodValidationPipe(productImageSchema)) body: ProductImageInput) {
    await this.assertCanEditProduct(user, id)
    const product = await this.prisma.product.findUnique({ where: { id } })
    if (!product) throw Errors.notFound('Product not found.')
    validateImageRef(body.url)
    const count = await this.prisma.productImage.count({ where: { productId: id } })
    return this.prisma.productImage.create({
      data: { productId: id, url: body.url, alt: body.alt ?? product.name, position: count },
    })
  }

  /** Image upload — base64 image → local/uploads (served statically in
   * production; on an external host swap the write target for object
   * storage). Type + size + ownership validated server-side. */
  @Roles('SELLER', 'ADMIN', 'SUPER_ADMIN')
  @Post(':id/images/upload')
  async uploadImage(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { data?: string; filename?: string; mime?: string; alt?: string },
  ) {
    await this.assertCanEditProduct(user, id)
    const product = await this.prisma.product.findUnique({ where: { id } })
    if (!product) throw Errors.notFound('Product not found.')
    if (!body?.data || typeof body.data !== 'string') throw Errors.badRequest('Image data is required.')

    const match = /^data:(image\/(jpeg|png|webp|avif));base64,(.+)$/.exec(body.data)
    if (!match) throw Errors.badRequest('Upload a jpg, png, webp or avif image.')
    const mime = match[1]
    const ext = mime === 'image/jpeg' ? 'jpg' : mime.split('/')[1]
    const bytes = Buffer.from(match[3], 'base64')
    if (bytes.length < 512) throw Errors.badRequest('Image is too small to be a real photo.')
    if (bytes.length > 2 * 1024 * 1024) throw Errors.badRequest('Image must be under 2 MB.')

    // Default: <cwd>/public/uploads (production runs from the repo root);
    // when the process runs from the backend/ folder (dev), fall back to the
    // repo-root public directory so dev and prod share the same uploads.
    const envDir = process.env.NEARBUY_UPLOAD_DIR
    const uploadsDir = envDir
      ? path.resolve(envDir)
      : existsSync(path.join(process.cwd(), 'public', 'uploads'))
        ? path.join(process.cwd(), 'public', 'uploads', 'products')
        : path.join(process.cwd(), '..', 'public', 'uploads', 'products')
    mkdirSync(uploadsDir, { recursive: true })
    const name = `${createHash('sha1').update(match[3]).digest('hex').slice(0, 16)}-${randomBytes(3).toString('hex')}.${ext}`
    writeFileSync(path.join(uploadsDir, name), bytes)
    const url = `/uploads/products/${name}`

    const count = await this.prisma.productImage.count({ where: { productId: id } })
    return this.prisma.productImage.create({
      data: { productId: id, url, alt: body.alt ?? product.name, position: count },
    })
  }
}

@Controller('categories')
export class CategoriesController {
  constructor(private readonly prisma: PrismaService) {}
  @Public()
  @Get()
  list() {
    return this.prisma.category.findMany({ include: { _count: { select: { products: true } } } })
  }
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60)
}

export function validateImageRef(url: string): void {
  if (!/^https?:\/\//i.test(url) && !url.startsWith('/uploads/')) {
    throw Errors.badRequest('Invalid image reference.')
  }
  const ext = url.split('?')[0].toLowerCase().match(/\.[a-z0-9]+$/)?.[0]
  if (ext && !ALLOWED_IMAGE_EXT.includes(ext)) {
    throw Errors.badRequest('Unsupported image type. Use jpg, png, webp or avif.')
  }
  if (url.length > 500) throw Errors.badRequest('Image reference too long.')
}

@Module({ controllers: [ProductsController, CategoriesController] })
export class ProductsModule {}
