import type { Request, Response, NextFunction } from 'express';
import { Prisma } from '../../generated/prisma/client.js';
import { AppError } from './AppError.js';
import { asyncHandler } from './asyncHandler.js';
import { okResponse } from './apiResponse.js';

interface PrismaModelDelegate<T> {
  findMany(args?: unknown): Promise<T[]>;
  findUnique(args?: unknown): Promise<T | null>;
  create(args?: unknown): Promise<T>;
  update(args?: unknown): Promise<T>;
  delete(args?: unknown): Promise<T>;
}

export const getAll = <T>(model: PrismaModelDelegate<T>) =>
  asyncHandler(async (_req: Request, res: Response) => {
    const docs = await model.findMany();
    res.status(200).json(okResponse('Documents fetched successfully', docs));
  });

export const getOne = <T>(model: PrismaModelDelegate<T>) =>
  asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    const doc = await model.findUnique({ where: { id: req.params.id } });
    if (!doc) {
      return next(new AppError('Document not found', 404));
    }
    (_res as Response)
      .status(200)
      .json(okResponse('Document fetched successfully', doc));
  });

export const createOne = <T>(model: PrismaModelDelegate<T>) =>
  asyncHandler(async (req: Request, res: Response) => {
    const doc = await model.create({ data: req.body });
    res.status(201).json(okResponse('Document created successfully', doc));
  });

export const updateOne = <T>(model: PrismaModelDelegate<T>) =>
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    try {
      const doc = await model.update({
        where: { id: req.params.id },
        data: req.body,
      });
      res.status(200).json(okResponse('Document updated successfully', doc));
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        return next(new AppError('Document not found', 404));
      }
      return next(error as Error);
    }
  });

export const deleteOne = <T>(model: PrismaModelDelegate<T>) =>
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    try {
      const doc = await model.delete({ where: { id: req.params.id } });
      res.status(200).json(okResponse('Document deleted successfully', doc));
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        return next(new AppError('Document not found', 404));
      }
      return next(error as Error);
    }
  });
