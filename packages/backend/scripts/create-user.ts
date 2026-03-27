import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = 'sahi0046@yahoo.com';
  const password = 'Sahi@0045';
  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash: hashedPassword,
    },
    create: {
      email,
      passwordHash: hashedPassword,
      firstName: 'Sahith',
      lastName: 'Project',
      role: 'CLIENT',
      isEmailVerified: true,
      isActive: true,
    },
  });

  console.log('User created/updated:', user.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
