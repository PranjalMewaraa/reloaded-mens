import {
  BadRequestException,
  Controller,
  Inject,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ADMIN_ROLE } from '@repo/types';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { User, type AuthedUser } from '../auth/decorators/user.decorator.js';
import { STORAGE_PROVIDER, type StorageProvider } from '../storage/storage.types.js';

const ALLOWED_IMAGE_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/avif',
  'image/gif',
]);

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

@Controller('uploads')
@UseGuards(JwtAccessGuard, RolesGuard)
@Roles(ADMIN_ROLE.ADMIN, ADMIN_ROLE.STAFF)
export class UploadsController {
  constructor(@Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider) {}

  // POST /uploads/image
  // multipart/form-data — single field 'file'. Returns { key, url } so the admin app can
  // append the URL into Product.images or Category.imageUrl without a follow-up read.
  @Post('image')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_BYTES } }))
  async uploadImage(
    @UploadedFile() file: Express.Multer.File | undefined,
    @User() _user: AuthedUser,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided. Send field "file" as multipart.');
    }
    if (file.size <= 0) {
      throw new BadRequestException('Empty file');
    }
    if (!ALLOWED_IMAGE_MIMES.has(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported image type "${file.mimetype}". Allowed: png, jpeg, webp, avif, gif`,
      );
    }

    const result = await this.storage.upload({
      buffer: file.buffer,
      mimetype: file.mimetype,
      originalName: file.originalname,
      folder: 'products',
    });
    return result;
  }
}
