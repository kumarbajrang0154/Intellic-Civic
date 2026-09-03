import { PrismaClient, UserRole, AuthProvider, ComplaintStatus, PriorityLevel, EvidenceStage } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Prisma database seeding...');

  // 1. Seed Departments
  const departments = [
    {
      id: 'dept_roads_infra',
      name: 'Roads & Infrastructure',
      description: 'Maintenance of municipal roads, bridges, flyovers, potholes, stormwater drains, and traffic corridors.',
      headOfficeAddress: 'Civic Centre, Floor 3, Block A, Central City Avenue',
      isSuspended: false,
    },
    {
      id: 'dept_water_sanitation',
      name: 'Water Supply & Sanitation',
      description: 'Potable water pipelines, sewage treatment, drainage clearance, and water quality control.',
      headOfficeAddress: 'Jal Bhawan, Sector 12, Smart City Corridor',
      isSuspended: false,
    },
    {
      id: 'dept_solid_waste',
      name: 'Solid Waste Management',
      description: 'Garbage collection, community dumpsters, recycling plants, street sweeping, and hazardous waste disposal.',
      headOfficeAddress: 'Swachh Tower, Ring Road Complex, North Zone',
      isSuspended: false,
    },
    {
      id: 'dept_electricity_lights',
      name: 'Electricity & Streetlights',
      description: 'Public streetlight networks, electrical poles, transformer maintenance, and solar grid infrastructure.',
      headOfficeAddress: 'Urja Bhawan, Power Grid Road, East District',
      isSuspended: false,
    },
    {
      id: 'dept_health_sanitation',
      name: 'Health & Public Sanitation',
      description: 'Vector control, public toilets hygiene, food safety inspections, and stray animal management.',
      headOfficeAddress: 'Health Headquarters, Civic Hospital Campus, West Ward',
      isSuspended: false,
    },
    {
      id: 'dept_urban_planning',
      name: 'Urban Planning & Encroachment',
      description: 'Zoning enforcement, anti-encroachment drives, illegal construction checks, and public park maintenance.',
      headOfficeAddress: 'Vikas Bhawan, Master Plan Enclave, South Zone',
      isSuspended: false,
    },
  ];

  for (const dept of departments) {
    await prisma.department.upsert({
      where: { id: dept.id },
      update: dept,
      create: dept,
    });
  }
  console.log(`✅ Seeded ${departments.length} departments.`);

  // 2. Seed Categories
  const categories = [
    {
      id: 'cat-sanitation',
      name: 'Sanitation & Solid Waste',
      description: 'Garbage collection, street cleaning, overflow dumpsters, waste disposal.',
      departmentId: 'dept_solid_waste',
    },
    {
      id: 'cat-roads',
      name: 'Roads & Infrastructure',
      description: 'Potholes, broken footpaths, damaged bridges, missing manhole covers.',
      departmentId: 'dept_roads_infra',
    },
    {
      id: 'cat-water',
      name: 'Water Supply & Sanitation',
      description: 'Pipeline leaks, contaminated water supply, low pressure, drainage blockage.',
      departmentId: 'dept_water_sanitation',
    },
    {
      id: 'cat-electricity',
      name: 'Electricity & Streetlights',
      description: 'Non-functional streetlights, dangerous loose wiring, transformer spark.',
      departmentId: 'dept_electricity_lights',
    },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { id: cat.id },
      update: cat,
      create: cat,
    });
  }
  console.log(`✅ Seeded ${categories.length} categories.`);

  // 3. Seed Core Users
  const users = [
    {
      id: 'usr_super_admin',
      name: 'Bajrang Kumar (Super Admin)',
      email: 'kumarbajrang325@gmail.com',
      role: UserRole.SUPER_ADMIN,
      authProvider: AuthProvider.GOOGLE,
      isAuthorized: true,
      isSuspended: false,
    },
    {
      id: 'usr_dept_head_roads',
      name: 'Rajesh Sharma',
      email: 'head.roads@smartcity.gov.in',
      role: UserRole.DEPARTMENT_HEAD,
      authProvider: AuthProvider.GOOGLE,
      departmentId: 'dept_roads_infra',
      isAuthorized: true,
      isSuspended: false,
    },
    {
      id: 'usr_officer_roads_1',
      name: 'Amit Patel',
      email: 'officer.roads@smartcity.gov.in',
      role: UserRole.DEPARTMENT_OFFICER,
      authProvider: AuthProvider.GOOGLE,
      departmentId: 'dept_roads_infra',
      isAuthorized: true,
      isSuspended: false,
    },
    {
      id: 'fw-demo-1',
      name: 'Ramesh Kumar',
      email: 'fieldworker@intellicivic.gov.in',
      role: UserRole.FIELD_WORKER,
      authProvider: AuthProvider.GOOGLE,
      departmentId: 'dept_roads_infra',
      isAuthorized: true,
      isSuspended: false,
    },
    {
      id: 'citizen_9876543210',
      name: 'Bajrang Kumar',
      mobileNumber: '9876543210',
      email: 'kumarbajrang0154@gmail.com',
      role: UserRole.CITIZEN,
      authProvider: AuthProvider.MOBILE_OTP,
      isAuthorized: true,
      isSuspended: false,
    },
  ];

  let citizenUserId = 'citizen_9876543210';
  let fieldWorkerUserId = 'fw-demo-1';

  for (const user of users) {
    let existing = await prisma.user.findUnique({ where: { id: user.id } });
    if (!existing && user.email) {
      existing = await prisma.user.findUnique({ where: { email: user.email } });
    }
    if (!existing && user.mobileNumber) {
      existing = await prisma.user.findUnique({ where: { mobileNumber: user.mobileNumber } });
    }

    if (existing) {
      const updated = await prisma.user.update({
        where: { id: existing.id },
        data: {
          name: user.name,
          role: user.role,
          authProvider: user.authProvider,
          departmentId: user.departmentId ?? existing.departmentId,
          isAuthorized: user.isAuthorized,
          isSuspended: user.isSuspended,
        },
      });
      if (user.id === 'citizen_9876543210') citizenUserId = updated.id;
      if (user.id === 'fw-demo-1') fieldWorkerUserId = updated.id;
    } else {
      const created = await prisma.user.create({
        data: user,
      });
      if (user.id === 'citizen_9876543210') citizenUserId = created.id;
      if (user.id === 'fw-demo-1') fieldWorkerUserId = created.id;
    }
  }
  console.log(`✅ Seeded ${users.length} core users.`);

  // 4. Seed Demo Complaints
  const demoComplaints = [
    {
      id: 'cmp-resolved-demo',
      ticketId: 'INC-2026-0901-1001',
      title: 'Pothole on Main Street',
      description: 'Deep asphalt pothole near Signal 4 causing traffic congestion.',
      status: ComplaintStatus.RESOLVED,
      priority: PriorityLevel.HIGH,
      citizenId: citizenUserId,
      categoryId: 'cat-roads',
      originalCategoryId: 'cat-roads',
      departmentId: 'dept_roads_infra',
      resolutionNotes: 'Asphalt resurfacing completed by municipal road crew.',
      resolvedAt: new Date(Date.now() - 86400000),
    },
    {
      id: 'cmp-rejected-demo',
      ticketId: 'INC-2026-0901-2002',
      title: 'Private Society Yard Cleaning Request',
      description: 'Garbage accumulation inside private residential society quadrangle.',
      status: ComplaintStatus.REJECTED,
      priority: PriorityLevel.LOW,
      citizenId: citizenUserId,
      categoryId: 'cat-sanitation',
      originalCategoryId: 'cat-sanitation',
      departmentId: 'dept_solid_waste',
      resolutionNotes: 'Municipal services only cover public corridors.',
    },
    {
      id: 'cmp-field-assigned',
      ticketId: 'INC-2026-0902-7711',
      title: 'Broken Traffic Light Wiring at Ring Road Crossing',
      description: 'Traffic signal control box door damaged. Wires exposed causing traffic light disruption.',
      status: ComplaintStatus.ASSIGNED,
      priority: PriorityLevel.HIGH,
      citizenId: citizenUserId,
      categoryId: 'cat-electricity',
      originalCategoryId: 'cat-electricity',
      departmentId: 'dept_roads_infra',
      assignedFieldWorkerId: fieldWorkerUserId,
    },
    {
      id: 'cmp-field-review-ready',
      ticketId: 'INC-2026-0902-7722',
      title: 'Severe Asphalt Pothole Repair on Central Flyover',
      description: 'Large 3-foot pothole on northbound lane repaired by field crew with cold-mix asphalt.',
      status: ComplaintStatus.IN_PROGRESS,
      priority: PriorityLevel.CRITICAL,
      citizenId: citizenUserId,
      categoryId: 'cat-roads',
      originalCategoryId: 'cat-roads',
      departmentId: 'dept_roads_infra',
      assignedFieldWorkerId: fieldWorkerUserId,
      readyForReview: true,
      fieldWorkerRemarks: 'Pothole patch sealed with cold-mix asphalt and steam roller compacted.',
    },
  ];

  for (const comp of demoComplaints) {
    await prisma.complaint.upsert({
      where: { id: comp.id },
      update: comp,
      create: comp,
    });
  }
  console.log(`✅ Seeded ${demoComplaints.length} demo complaints.`);

  // Seed sample evidence for review ready ticket
  const existingEv = await prisma.evidence.findFirst({ where: { complaintId: 'cmp-field-review-ready' } });
  if (!existingEv) {
    await prisma.evidence.createMany({
      data: [
        {
          complaintId: 'cmp-field-review-ready',
          stage: EvidenceStage.BEFORE,
          imageUrl: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=600',
          uploadedByUserId: fieldWorkerUserId,
          notes: 'Before repair inspection',
        },
        {
          complaintId: 'cmp-field-review-ready',
          stage: EvidenceStage.AFTER,
          imageUrl: 'https://images.unsplash.com/photo-1584467735871-8e85353a8413?w=600',
          uploadedByUserId: fieldWorkerUserId,
          notes: 'After repair patch completed',
        },
      ],
    });
    console.log('✅ Seeded evidence photos for demo ticket.');
  }

  console.log('🎉 Database seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
