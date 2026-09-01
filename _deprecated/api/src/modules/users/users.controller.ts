import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ApproveUserDto } from './dto/approve-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  async findAll(@Query() query: ListUsersQueryDto) {
    return this.usersService.findAll(query);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  async findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id/approve')
  @Roles(UserRole.ADMIN)
  async approveUser(
    @Param('id') id: string,
    @Body() dto: ApproveUserDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.usersService.approveUser(id, dto, user.id);
  }

  @Post(':id/approve')
  @Roles(UserRole.ADMIN)
  async approveUserPost(
    @Param('id') id: string,
    @Body() dto: ApproveUserDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.usersService.approveUser(id, dto, user.id);
  }

  @Patch(':id/reject')
  @Roles(UserRole.ADMIN)
  async rejectUser(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.usersService.rejectUser(id, user.id);
  }

  @Post(':id/reject')
  @Roles(UserRole.ADMIN)
  async rejectUserPost(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.usersService.rejectUser(id, user.id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  async updateUser(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.usersService.updateUser(id, dto, user.id);
  }
}
