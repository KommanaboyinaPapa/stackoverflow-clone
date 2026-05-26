import Home from '../pages/Home';
import Login from '../pages/Login';
import Register from '../pages/Register';
import AskQuestion from '../pages/AskQuestion';
import Questions from '../pages/Questions';
import QuestionDetail from '../pages/QuestionDetail';
import Profile from '../pages/Profile';

const routes = [
  { path: '/', element: <Home />, label: 'Home' },
  { path: '/questions', element: <Questions />, label: 'Questions' },
  { path: '/questions/:id', element: <QuestionDetail />, label: 'Question Detail' },
  { path: '/login', element: <Login />, label: 'Login' },
  { path: '/register', element: <Register />, label: 'Register' },
  { path: '/ask', element: <AskQuestion />, label: 'Ask Question' },
  { path: '/profile', element: <Profile />, label: 'Profile' },
];

export default routes;
