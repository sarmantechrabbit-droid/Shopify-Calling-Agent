import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  const configs = await prisma.appConfig.findMany();
  console.log('Configs:', JSON.stringify(configs, null, 2));
  process.exit(0);
}
run();
