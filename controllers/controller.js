import User from '../Models/EmailUser.js';
import passport from 'passport';
import sgMail from '@sendgrid/mail';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

export const login = (req, res) => {
  res.render('login', {message: req.query.action});
}

export const verifyLogin = 
  passport.authenticate('local', { successRedirect: '/?action=logIn',
                                   failureRedirect: '/?action=failedLogIn',
                                   failureFlash: false });

export const register = (req, res) => {
  res.render('register');
}

export const verifyRegister = async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = new User({ username, password });
    await user.save();
    res.redirect('/?action=newUser');
  } catch (error) {
    res.send(error.message);
  }
};

export const logout = (req, res) => {
  req.logout(function(err) {
    if (err) { return next(err); }
    // Redirect or respond after successful logout
    res.redirect('/');
  });
}  

//EMAIL LOGIC
export const askForPassword = (req, res) => {
  res.render('requestPassword');
}

export const sendPassword = async (req, res) => {
  const { username } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) {
      // Handle case when user is not found
      return res.status(404).send('User not found.');
    }

    // Generate a token
    const token = crypto.randomBytes(20).toString('hex');
    // Set token and expiration
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

    await user.save();
    
    // Send email with reset link
    const resetUrl = `http://${req.headers.host}/reset/${token}`;
    const msg = {
      to: user.username,
      from: 'dcalmeyer@westridge.org', // Use your verified sender
      subject: 'Password Reset',
      text: `You are receiving this because you (or someone else) requested a password reset for your account.\n\n` +
      `Please click on the following link, or paste it into your browser to complete the process within one hour of receiving it:\n\n` +
      `${resetUrl}\n\n` +
      `If you did not request this, please ignore this email and your password will remain unchanged.`,
    };

    await sgMail.send(msg);
    console.log(`${user.username} sent email`);
    
    res.redirect('/?action=emailSent');
  } catch (error) {
    console.error('Password reset request error:', error);
    res.status(500).send('Error processing password reset request.');
  }
};

export const resetPassword  = async (req, res) => {
  const user = await User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } });
  if (!user) {
    // Handle error - token invalid or expired
    return res.status(400).send('Password reset token is invalid or has expired.');
  }
  // Render reset password form
  res.render('resetPassword', { token: req.params.token });
};

export const updatePassword  = async (req, res) => {
  const { password, confirmPassword } = req.body;
  const { token } = req.params;

  // Validate the passwords match
  if (password !== confirmPassword) {
    return res.render('resetPassword', { 
      token,
      errorMessage: 'Passwords do not match.' 
    });
  }

  try {
    // Ensure the token is still valid and find the associated user
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });
    console.log("Found " + user.username);
    
    if (!user) {
      return res.status(400).render('resetPassword', { 
        token,
        errorMessage: 'Password reset token is invalid or has expired.' 
      });
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.redirect('/?action=passwordUpdated!');

  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).send('An error occurred while resetting your password. Please try again.');
  }
};








