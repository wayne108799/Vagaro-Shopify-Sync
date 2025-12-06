import { storage } from "./storage";

async function seed() {
  console.log("Seeding database...");

  // Create default stylists
  const stylists = [
    { name: "Sarah Jenkins", role: "Senior Stylist", commissionRate: 45, vagaroId: "emp_001", enabled: true },
    { name: "Michael Chen", role: "Colorist", commissionRate: 40, vagaroId: "emp_002", enabled: true },
    { name: "Jessica Wu", role: "Junior Stylist", commissionRate: 35, vagaroId: "emp_003", enabled: false },
    { name: "David Miller", role: "Barber", commissionRate: 40, vagaroId: "emp_004", enabled: false },
  ];

  for (const stylist of stylists) {
    try {
      await storage.createStylist(stylist);
      console.log(`Created stylist: ${stylist.name}`);
    } catch (error) {
      console.log(`Stylist ${stylist.name} may already exist`);
    }
  }

  console.log("Seeding complete!");
  process.exit(0);
}

seed().catch(console.error);