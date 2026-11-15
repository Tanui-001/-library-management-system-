import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  const librarianEmail = process.env.LIBRARIAN_EMAIL;
  const librarianPassword = process.env.LIBRARIAN_PASSWORD;
  if (!librarianEmail || !librarianPassword || librarianPassword.length < 16) {
    throw new Error(
      'Set LIBRARIAN_EMAIL and a LIBRARIAN_PASSWORD of at least 16 characters before seeding',
    );
  }
  const hashedPassword = await bcrypt.hash(librarianPassword, 12);

  const librarian = await prisma.user.upsert({
    where: { email: librarianEmail },
    update: {
      name: 'Head Librarian',
      password: hashedPassword,
      role: UserRole.LIBRARIAN,
    },
    create: {
      email: librarianEmail,
      name: 'Head Librarian',
      password: hashedPassword,
      role: UserRole.LIBRARIAN,
    },
  });

  console.log(`Librarian created/verified: ${librarian.email}`);

  // 2. Seed Genres
  const fiction = await prisma.genre.upsert({
    where: { name: 'Fiction' },
    update: {},
    create: { name: 'Fiction', description: 'Fictional books' },
  });

  const science = await prisma.genre.upsert({
    where: { name: 'Science' },
    update: {},
    create: { name: 'Science', description: 'Scientific literature' },
  });

  // 3. Seed Books (Using the genres created above)
  await prisma.book.upsert({
    where: { isbn: '978-3-16-148410-0' },
    update: {},
    create: {
      title: 'The Great Gatsby',
      author: 'F. Scott Fitzgerald',
      isbn: '978-3-16-148410-0',
      totalCopies: 5,
      genreId: fiction.id,
    },
  });

  await prisma.book.upsert({
    where: { isbn: '978-0-306-40615-7' },
    update: {},
    create: {
      title: 'A Brief History of Time',
      author: 'Stephen Hawking',
      isbn: '978-0-306-40615-7',
      totalCopies: 3,
      genreId: science.id,
    },
  });

  console.log('Seed completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });