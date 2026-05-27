import React, { useCallback, useEffect, useState } from 'react';

import BackButton from '../components/BackButton';
import { useLanguage } from '../context/LanguageContext';

import CreatePostForm from '../components/CreatePostForm';

import FriendRequestsPanel from '../components/FriendRequestsPanel';

import SocialPostCard from '../components/SocialPostCard';

import { getFeed, getPostingLimit } from '../services/socialService';

import getErrorMessage from '../utils/getErrorMessage';



const Social = () => {
  const { t } = useLanguage();
  const [posts, setPosts] = useState([]);

  const [limitInfo, setLimitInfo] = useState(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState('');



  const loadLimit = useCallback(async () => {

    try {

      const data = await getPostingLimit();

      setLimitInfo(data);

    } catch {

      setLimitInfo({ canPost: false, friendCount: 0, dailyLimit: 0 });

    }

  }, []);



  const loadFeed = useCallback(async () => {

    setError('');

    try {

      const data = await getFeed();

      setPosts(data.posts || []);

    } catch (err) {

      setError(getErrorMessage(err, t('social.loadFailed', 'Failed to load feed.')));

    }

  }, [t]);



  const refresh = useCallback(async () => {

    await Promise.all([loadFeed(), loadLimit()]);

  }, [loadFeed, loadLimit]);



  useEffect(() => {

    const init = async () => {

      setLoading(true);

      await refresh();

      setLoading(false);

    };

    init();

  }, [refresh]);



  const handlePosted = () => refresh();

  const handleFriendsChanged = () => refresh();



  return (

    <div className="page social-page">

      <div className="page-content social-page-inner">

        <BackButton />

        <header className="social-page-header">

          <h1>{t('social.title')}</h1>

          <p className="social-page-subtitle">{t('social.subtitle')}</p>

        </header>



        <div className="social-layout">

          <aside className="social-sidebar">

            <FriendRequestsPanel onFriendsChanged={handleFriendsChanged} />

          </aside>



          <section className="social-main">

            <CreatePostForm

              canPost={limitInfo?.canPost}

              limitInfo={limitInfo}

              onPosted={handlePosted}

            />



            {error && <div className="alert alert-error">{error}</div>}



            {loading ? (

              <div className="social-loading">

                <div className="loading-spinner" />

                <p>{t('social.loading')}</p>

              </div>

            ) : posts.length === 0 ? (

              <div className="empty-state">

                <p>{t('social.empty')}</p>

              </div>

            ) : (

              <div className="social-feed">

                {posts.map((post) => (

                  <SocialPostCard key={post._id} post={post} onUpdate={loadFeed} />

                ))}

              </div>

            )}

          </section>

        </div>

      </div>

    </div>

  );

};



export default Social;

