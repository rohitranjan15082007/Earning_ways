import { PrismaClient } from "../../generated/prisma/client.js"; // Adjust if needed, e.g., to "../generated/prisma" if config is at root

const prisma = new PrismaClient();

export default prisma;