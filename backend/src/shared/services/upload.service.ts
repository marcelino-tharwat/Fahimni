import { cloudinary } from '../../config/cloudinary.js';
import { AppError } from '../utils/AppError.js';

export class UploadService {
  public async uploadImage(buffer: Buffer, folder: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder, resource_type: 'image' },
        (error, result) => {
          if (error || !result) {
            reject(new AppError('Failed to upload image', 500));
            return;
          }
          resolve(result.secure_url);
        },
      );

      uploadStream.end(buffer);
    });
  }

  public async uploadPhoto(buffer: Buffer): Promise<string> {
    return this.uploadImage(buffer, 'teachers/photos');
  }

  public async uploadLogo(buffer: Buffer): Promise<string> {
    return this.uploadImage(buffer, 'teachers/logos');
  }
}
