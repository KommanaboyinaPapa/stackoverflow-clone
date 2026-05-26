const mongoose = require('mongoose');
const User = require('./models/User');
const bcrypt = require('bcryptjs');

async function debugFlow() {
  const uri = 'mongodb://127.0.0.1:27017/stackoverflow';
  try {
    await mongoose.connect(uri);
    console.log('Connected to MongoDB successfully\n');

    // Test data
    const name = 'Test Flow User';
    const email = 'flowuser_' + Date.now() + '@example.com';
    const password = 'mypassword123';

    console.log('=== REGISTER STEP ===');
    console.log(`1. Raw Password: "${password}"`);
    console.log(`2. Raw Password Length: ${password.length}`);

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    console.log(`3. Hashed Password generated: ${hashedPassword}`);
    console.log(`4. Hashed Password length: ${hashedPassword.length}`);

    // Save to DB
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
    });
    console.log('User.create completed.');

    // Fetch back from DB to see if password is saved exactly
    const savedUser = await User.findById(user._id).select('+password');
    console.log(`5. Saved Password from DB: ${savedUser.password}`);
    console.log(`6. Saved Password length: ${savedUser.password ? savedUser.password.length : 0}`);

    console.log('\n=== LOGIN STEP ===');
    console.log(`1. Entered password: "${password}"`);
    console.log(`2. Entered password length: ${password.length}`);
    console.log(`3. DB Hash used for comparison: ${savedUser.password}`);
    
    // Compare
    const isMatch = await bcrypt.compare(password, savedUser.password);
    console.log(`4. bcrypt.compare result: ${isMatch}`);

    // Clean up
    await User.deleteOne({ _id: user._id });
    console.log('\nTemporary flow user deleted.');

  } catch (err) {
    console.error('Error during flow:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

debugFlow();
