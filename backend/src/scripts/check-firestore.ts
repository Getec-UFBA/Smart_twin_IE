import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const formatPrivateKey = (key?: string) => {
  if (!key) return undefined;
  return key.replace(/\\n/g, '\n').replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
};

const privateKey = formatPrivateKey(process.env.PRIVATE_KEY_FB || process.env.FIREBASE_PRIVATE_KEY || process.env.FB_PRIVATE_KEY);
const projectId = process.env.PROJECT_ID_FB || process.env.FIREBASE_PROJECT_ID || process.env.FB_PROJECT_ID;
const clientEmail = process.env.CLIENT_EMAIL_FB || process.env.FIREBASE_CLIENT_EMAIL || process.env.FB_CLIENT_EMAIL;

if (projectId && clientEmail && privateKey) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
  
  const db = admin.firestore();
  db.collection('projects').get().then(snapshot => {
    console.log(`Total projects: ${snapshot.size}`);
    snapshot.docs.forEach(doc => {
      console.log(`- Project: ${doc.id}, Name: ${doc.data().name}`);
    });
    process.exit(0);
  }).catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
} else {
  console.error('Missing credentials');
  process.exit(1);
}
