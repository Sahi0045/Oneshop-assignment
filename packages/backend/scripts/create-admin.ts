import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@freelancer.com';
  const password = 'Admin@123';
  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash: hashedPassword,
      role: 'ADMIN',
    },
    create: {
      email,
      passwordHash: hashedPassword,
      firstName: 'System',
      lastName: 'Admin',
      role: 'ADMIN',
      isEmailVerified: true,
      isActive: true,
      profileCompleteness: 100,
    },
  });

  console.log('Admin user created/updated:', user.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
