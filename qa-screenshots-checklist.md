# QA Screenshot Evidence Checklist

This checklist enumerates the exact screenshots required for internship submission evidence.

| # | Screenshot Name | Page / Route | Action | Expected Result | File Name |
|---|---|---|---|---|---|
| 1 | Social page loaded | `/social` | Open the social feed page after login | Social feed page loads with feed, create post panel, and sidebar | `social-page-loaded.png` |
| 2 | 0-friend posting restriction | `/social` | Use an account with 0 friends and try to post | Post creation disabled or limit warning displayed | `social-posting-0-friends.png` |
| 3 | 1-friend post success | `/social` | Use an account with 1 friend and create one post | First post created successfully and visible in feed | `social-posting-1-friend.png` |
| 4 | Like/comment/share working | `/social` | Like a post, add a comment, and share a post | Like/comment/share counts update correctly | `social-like-comment-share.png` |
| 5 | Image/video upload | `/social` | Create a post with an image and/or video upload | Media uploads successfully and appears in the new post | `social-media-upload.png` |
| 6 | Forgot password page | `/forgot-password` | Open forgot password page | Forgot password page is visible with email/phone inputs | `forgot-password-page.png` |
| 7 | Email OTP request | `/forgot-password` | Request password reset using registered email | Email OTP request accepted, OTP prompt or success message shown | `forgot-password-email-otp.png` |
| 8 | Phone OTP request | `/forgot-password` | Request password reset using registered phone | Phone OTP request accepted, OTP prompt or success message shown | `forgot-password-phone-otp.png` |
| 9 | Second request blocked | `/forgot-password` | Submit second forgot-password request on same day | Block message shown: daily limit warning | `forgot-password-second-request-blocked.png` |
| 10 | Letters-only generated password | `/forgot-password` | Complete OTP verification and reveal generated password | Generated password contains only letters A-Z / a-z | `forgot-password-generated-password.png` |
| 11 | Subscription plans page | `/subscriptions` | Open subscription page | Plan grid displays Free, Bronze, Silver, Gold | `subscription-plans-page.png` |
| 12 | Razorpay checkout | `/subscriptions` | Click subscribe on a paid plan during allowed time | Razorpay checkout modal opens | `subscription-razorpay-checkout.png` |
| 13 | Payment success | `/subscriptions` | Complete Razorpay payment successfully | Subscription success panel shown with quota info | `subscription-payment-success.png` |
| 14 | Invoice email proof | `/subscriptions` | Complete payment and view invoice receipt | Invoice panel confirms email sent or receipt available | `subscription-invoice-proof.png` |
| 15 | Payment window blocked | `/subscriptions` | Attempt subscription outside allowed payment window | Block message shows payment window closed | `subscription-payment-window-blocked.png` |
| 16 | Answer +5 points | `/questions/:id` | Post an answer on a question | Points awarded +5 on answer submission | `reward-answer-plus5.png` |
| 17 | 5 upvotes bonus | `/questions/:id` | Reach 5 upvotes on an answer | Bonus +5 points awarded for 5 upvotes | `reward-5-upvotes-bonus.png` |
| 18 | Points transfer success | `/profile` | Transfer points when sender has >10 points | Transfer completes successfully and balances update | `reward-transfer-success.png` |
| 19 | Transfer blocked <=10 | `/profile` | Attempt transfer with <=10 points | Transfer blocked with error message | `reward-transfer-blocked.png` |
| 20 | Language selector | any page with header | Open language selector dropdown | Language selector visible with language options | `language-selector.png` |
| 21 | French email OTP | any page with language selection | Select French language as authenticated user | Email OTP flow triggered for French | `language-french-email-otp.png` |
| 22 | Other language mobile OTP | any page with language selection | Select Spanish/Hindi/Portuguese/Chinese | Mobile OTP flow triggered for non-French languages | `language-mobile-otp.png` |
| 23 | Chrome OTP login | login | Sign in from Google Chrome with new device ID | OTP email login flow triggers via Chrome | `login-chrome-otp.png` |
| 24 | Edge login no OTP | login | Sign in from Microsoft Edge with new device ID | Login completes without OTP verification | `login-edge-no-otp.png` |
| 25 | Mobile time restriction | login | Sign in from mobile outside 10:00–13:00 IST | Mobile login blocked with time restriction message | `login-mobile-time-restriction.png` |
| 26 | Profile login history | `/profile` | Open profile login history section | Login history records are visible | `profile-login-history.png` |
| 27 | Browser/OS/device/IP visible | `/profile` | View one login history entry | Browser, OS, device, and IP fields are visible | `profile-login-details.png` |

