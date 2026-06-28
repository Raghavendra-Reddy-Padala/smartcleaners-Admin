import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = {
  apiKey: "AIzaSyDBp_vEVahkIY216SmAkceBGcL_h6DVUhs",
  authDomain: "smartcleaners5.firebaseapp.com",
  projectId: "smartcleaners5",
  storageBucket: "smartcleaners5.firebasestorage.app",
  messagingSenderId: "371632438384",
  appId: "1:371632438384:web:7d6d6c283de217e01708b5"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const generateSlug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

// A basic mapping for some product categories
const guessCategory = (name) => {
  const lowerName = name.toLowerCase();
  if (lowerName.includes('glass')) return 'Glass Cleaner';
  if (lowerName.includes('air freshener')) return 'Air Freshener';
  if (lowerName.includes('body wash')) return 'Body Wash';
  if (lowerName.includes('floor cleaner')) return 'Floor Cleaner';
  if (lowerName.includes('scale remover')) return 'Scale Remover';
  if (lowerName.includes('hand wash')) return 'Hand Wash';
  if (lowerName.includes('laundry')) return 'Laundry Detergent';
  if (lowerName.includes('toilet cleaner')) return 'Toilet Cleaner';
  if (lowerName.includes('dishwash')) return 'Dishwash Liquid';
  return 'General Cleaning';
};

// Extract volume to use in unit if possible
const guessMoqAndUnit = (name) => {
  if (name.includes('500 ml')) return { moq: 50, unit: '500ml Bottle' };
  if (name.includes('1 L') || name.includes('1L')) return { moq: 20, unit: '1L Bottle' };
  if (name.includes('5 L') || name.includes('5L')) return { moq: 10, unit: '5L Can' };
  return { moq: 50, unit: 'Piece' };
};

async function seed() {
  try {
    const raw = fs.readFileSync('../../products.json', 'utf8');
    const products = JSON.parse(raw);

    console.log(`Found ${products.length} products to insert.`);
    let count = 0;

    for (const p of products) {
      const category = guessCategory(p.prodname);
      const { moq, unit } = guessMoqAndUnit(p.prodname);

      const newProduct = {
        name: p.prodname,
        slug: generateSlug(p.prodname),
        description: `High-quality ${p.prodname} for professional and commercial use.`,
        category: category,
        image: p.image,
        priceRange: 'Contact for Price', // Could not extract precise prices
        moq: moq,
        unit: unit,
        features: ['Professional Grade', 'Bulk Pricing Available'],
        isActive: true,
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'bulkProducts'), newProduct);
      console.log(`Added: ${newProduct.name}`);
      count++;
    }

    console.log(`Successfully inserted ${count} products.`);
    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
}

seed();
