import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.category.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        departmentId: true,
        department: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async create(dto: CreateCategoryDto) {
    const existing = await this.prisma.category.findUnique({
      where: { name: dto.name },
    });

    if (existing) {
      throw new BadRequestException('Category with this name already exists');
    }

    const dept = await this.prisma.department.findUnique({
      where: { id: dto.departmentId },
    });

    if (!dept) {
      throw new BadRequestException('Department not found');
    }

    return this.prisma.category.create({
      data: {
        name: dto.name,
        description: dto.description,
        departmentId: dto.departmentId,
      },
    });
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const category = await this.prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    if (dto.name && dto.name !== category.name) {
      const existing = await this.prisma.category.findUnique({
        where: { name: dto.name },
      });
      if (existing) {
        throw new BadRequestException('Category with this name already exists');
      }
    }

    if (dto.departmentId) {
      const dept = await this.prisma.department.findUnique({
        where: { id: dto.departmentId },
      });
      if (!dept) {
        throw new BadRequestException('Department not found');
      }
    }

    return this.prisma.category.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description && { description: dto.description }),
        ...(dto.departmentId && { departmentId: dto.departmentId }),
      },
    });
  }
}
