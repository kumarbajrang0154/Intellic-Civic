import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ComplaintStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../src/database/prisma.service';
import { UsersController } from '../src/modules/users/users.controller';
import { UsersService } from '../src/modules/users/users.service';
import { DepartmentsController } from '../src/modules/departments/departments.controller';
import { DepartmentsService } from '../src/modules/departments/departments.service';
import { CategoriesController } from '../src/modules/categories/categories.controller';
import { CategoriesService } from '../src/modules/categories/categories.service';
import { ComplaintsController } from '../src/modules/complaints/complaints.controller';
import { ComplaintsService } from '../src/modules/complaints/complaints.service';
import { AiService } from '../src/modules/ai/ai.service';

describe('AdminModule & Super Admin Operations (Module 9 Backend Tests)', () => {
  let usersController: UsersController;
  let usersService: UsersService;
  let departmentsController: DepartmentsController;
  let departmentsService: DepartmentsService;
  let categoriesController: CategoriesController;
  let categoriesService: CategoriesService;
  let complaintsController: ComplaintsController;
  let complaintsService: ComplaintsService;
  let prismaService: any;

  const mockAdminUser = {
    id: 'admin-uuid-1',
    role: UserRole.ADMIN,
    email: 'admin@city.gov',
    name: 'Super Admin',
  };

  const mockCitizenUser = {
    id: 'citizen-uuid-1',
    role: UserRole.CITIZEN,
    email: 'citizen@city.gov',
    name: 'Jane Citizen',
  };

  const mockPendingStaff = {
    id: 'pending-user-1',
    name: 'John Officer',
    email: 'john.officer@city.gov',
    role: null,
    isAuthorized: false,
    departmentId: null,
    createdAt: new Date(),
  };

  const mockDepartment = {
    id: 'dept-sanitation-101',
    name: 'Sanitation & Waste Management',
    description: 'Handles garbage collection and street cleaning',
    createdAt: new Date(),
    updatedAt: new Date(),
    _count: { users: 5, complaints: 12 },
  };

  beforeEach(async () => {
    prismaService = {
      $transaction: jest.fn().mockImplementation(async (cb) => cb(prismaService)),
      user: {
        findMany: jest.fn().mockResolvedValue([mockPendingStaff]),
        findUnique: jest.fn().mockResolvedValue(mockPendingStaff),
        count: jest.fn().mockResolvedValue(1),
        create: jest.fn(),
        update: jest.fn().mockImplementation(({ where, data }) => ({
          ...mockPendingStaff,
          ...data,
        })),
      } as any,
      department: {
        findMany: jest.fn().mockResolvedValue([mockDepartment]),
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id === 'dept-sanitation-101') return Promise.resolve(mockDepartment);
          return Promise.resolve(null);
        }),
        count: jest.fn().mockResolvedValue(1),
        create: jest.fn().mockImplementation(({ data }) => ({ id: 'new-dept-id', ...data })),
        update: jest.fn().mockImplementation(({ where, data }) => ({ ...mockDepartment, ...data, id: where.id })),
      } as any,
      category: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => ({ id: 'cat-new-id', ...data })),
        update: jest.fn().mockImplementation(({ where, data }) => ({ id: where.id, ...data })),
      } as any,
      complaint: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue({ id: 'cmp-101', departmentId: null }),
        count: jest.fn().mockResolvedValue(10),
        groupBy: jest.fn().mockResolvedValue([
          { status: ComplaintStatus.SUBMITTED, _count: { id: 3 } },
          { status: ComplaintStatus.IN_PROGRESS, _count: { id: 7 } },
        ]),
        update: jest.fn().mockResolvedValue({ id: 'cmp-101', departmentId: 'dept-sanitation-101' }),
      } as any,
      assignment: {
        upsert: jest.fn().mockResolvedValue({}),
      } as any,
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      } as any,
      fieldWorker: {
        findMany: jest.fn().mockResolvedValue([]),
      } as any,
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [
        UsersController,
        DepartmentsController,
        CategoriesController,
        ComplaintsController,
      ],
      providers: [
        UsersService,
        DepartmentsService,
        CategoriesService,
        ComplaintsService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
        {
          provide: AiService,
          useValue: {
            routeComplaint: jest.fn(),
          },
        },
      ],
    }).compile();

    usersController = module.get<UsersController>(UsersController);
    usersService = module.get<UsersService>(UsersService);
    departmentsController = module.get<DepartmentsController>(DepartmentsController);
    departmentsService = module.get<DepartmentsService>(DepartmentsService);
    categoriesController = module.get<CategoriesController>(CategoriesController);
    categoriesService = module.get<CategoriesService>(CategoriesService);
    complaintsController = module.get<ComplaintsController>(ComplaintsController);
    complaintsService = module.get<ComplaintsService>(ComplaintsService);
  });

  describe('1. User Approvals & Roster Management', () => {
    it('1a. Admin can list pending staff accounts with pendingOnly=true', async () => {
      const result = await usersController.findAll({ pendingOnly: true });

      expect(result.data).toBeDefined();
      expect(prismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isAuthorized: false }),
        }),
      );
    });

    it('1b. Admin can approve a pending staff user and set role/department', async () => {
      const res = await usersController.approveUser(
        'pending-user-1',
        { role: UserRole.DEPARTMENT_OFFICER, departmentId: 'dept-sanitation-101' },
        mockAdminUser,
      );

      expect(res.isAuthorized).toBe(true);
      expect(res.role).toBe(UserRole.DEPARTMENT_OFFICER);
      expect(prismaService.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'USER_APPROVED_BY_ADMIN' }),
        }),
      );
    });

    it('1c. Admin can reject a pending user account (isAuthorized = false)', async () => {
      const res = await usersController.rejectUser('pending-user-1', mockAdminUser);

      expect(res.isAuthorized).toBe(false);
      expect(prismaService.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'USER_REJECTED_BY_ADMIN' }),
        }),
      );
    });

    it('1d. Admin can update an existing user role and department', async () => {
      const res = await usersController.updateUser(
        'pending-user-1',
        { role: UserRole.DEPARTMENT_HEAD, departmentId: 'dept-sanitation-101' },
        mockAdminUser,
      );

      expect(res).toBeDefined();
      expect(prismaService.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'USER_UPDATED_BY_ADMIN' }),
        }),
      );
    });
  });

  describe('2. Department Management (CRUD)', () => {
    it('2a. Admin can fetch department list with complaint & staff metrics', async () => {
      const list = await departmentsController.findAll();

      expect(list).toHaveLength(1);
      expect(list[0].name).toBe('Sanitation & Waste Management');
      expect(list[0].staffCount).toBe(5);
    });

    it('2b. Admin can create a new department', async () => {
      const created = await departmentsController.create({
        name: 'Public Health & Safety',
        description: 'Handles restaurant hygiene inspections',
      });

      expect(created.name).toBe('Public Health & Safety');
      expect(prismaService.department.create).toHaveBeenCalled();
    });

    it('2c. Admin can edit an existing department', async () => {
      const updated = await departmentsController.update('dept-sanitation-101', {
        description: 'Updated description for sanitation department',
      });

      expect(updated.id).toBe('dept-sanitation-101');
      expect(prismaService.department.update).toHaveBeenCalled();
    });
  });

  describe('3. Category Management (CRUD)', () => {
    it('3a. Admin can create a new category', async () => {
      const created = await categoriesController.create({
        name: 'Pothole Repairs',
        description: 'Road surface damages',
        departmentId: 'dept-sanitation-101',
      });

      expect(created).toBeDefined();
      expect(prismaService.category.create).toHaveBeenCalled();
    });

    it('3b. Admin can edit an existing category', async () => {
      prismaService.category.findUnique.mockResolvedValueOnce({
        id: 'cat-1',
        name: 'Old Category',
        departmentId: 'dept-sanitation-101',
      });

      const updated = await categoriesController.update('cat-1', {
        name: 'Road Hazards & Potholes',
      });

      expect(updated).toBeDefined();
      expect(prismaService.category.update).toHaveBeenCalled();
    });
  });

  describe('4. System Stats & Access Control Regression Checks', () => {
    it('4a. Admin dashboard system stats endpoint returns metrics', async () => {
      const stats = await complaintsController.getSystemStats();

      expect(stats.totalComplaints).toBe(10);
      expect(stats.statusBreakdown).toBeDefined();
      expect(stats.needsTriageCount).toBe(10);
      expect(stats.pendingUserApprovalsCount).toBe(1);
      expect(stats.departmentCount).toBe(1);
    });

    it('4b. Access Control Check: UserRole.ADMIN can view any department staff roster', async () => {
      const staff = await departmentsController.getDepartmentStaff('dept-sanitation-101', mockAdminUser);

      expect(staff).toBeDefined();
      expect(staff.department.id).toBe('dept-sanitation-101');
    });

    it('4c. Access Control Check: Non-Admin role (CITIZEN) is forbidden from viewing department staff roster', async () => {
      await expect(
        departmentsService.getDepartmentStaff('dept-sanitation-101', mockCitizenUser as any),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
