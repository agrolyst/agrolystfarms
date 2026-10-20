/* Agrolyst Community Reviews — reusable, database-backed website widget. */
(function () {
  'use strict';
  const SUPABASE_URL = 'https://rcrgooivgssuerrgnuqw.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_j8SoLv73ssa13M_rAJwB6g_rPb8whHD';
  const SAVED_KEY = 'agrolyst_saved_review_ids_v1';
  const VISITOR_KEY = 'agrolyst_community_visitor_v1';
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const shortDate = value => { const d = new Date(value); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}); };
  function readList(key) { try { const value = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(value) ? value : []; } catch (_) { return []; } }
  function getVisitorId() {
    let id = '';
    try { id = localStorage.getItem(VISITOR_KEY) || ''; } catch (_) {}
    if (!/^[a-zA-Z0-9-]{16,80}$/.test(id)) {
      id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'visitor-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      try { localStorage.setItem(VISITOR_KEY, id); } catch (_) {}
    }
    return id;
  }
  function icon(name) {
    const paths = {
      heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/>',
      bookmark:'<path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-4-6 4Z"/>',
      message:'<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z"/>',
      send:'<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
      sort:'<path d="M3 6h18M6 12h12m-9 6h6"/>',
      leaf:'<path d="M20 4c-7 0-13 2-15 8-1 3 1 6 4 6 6 0 9-6 11-14Z"/><path d="M3 21c3-6 7-9 13-12"/>'
    };
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(paths[name]||'')+'</svg>';
  }
  function init(root) {
    if (root.dataset.reviewsReady === 'true') return;
    root.dataset.reviewsReady = 'true';
    root.classList.add('ag-reviews');
    const compact = root.dataset.compact === 'true';
    const limit = Math.min(50, Math.max(1, Number(root.dataset.limit) || (compact ? 6 : 30)));
    const title = root.dataset.title || 'The Agrolyst community';
    const subtitle = root.dataset.subtitle || 'Share your experience, ask a question, and help other farmers and agribusinesses learn from one another.';
    root.innerHTML = '<div class="agr-shell">'+
      '<div class="agr-heading"><div class="agr-eyebrow">'+icon('leaf')+' COMMUNITY VOICES</div><h2>'+esc(title)+'</h2><p>'+esc(subtitle)+'</p></div>'+
      '<div class="agr-grid"><section class="agr-main" aria-label="Community reviews">'+
      '<form class="agr-compose" data-form="review"><div class="agr-compose-top"><div class="agr-avatar agr-avatar--brand">A</div><div><strong>Share with the community</strong><small>Your real experience can help someone make a better decision.</small></div></div>'+
      '<div class="agr-form-grid"><label>Your name *<input name="author_name" required minlength="2" maxlength="80" autocomplete="name" placeholder="How should we address you?"></label>'+
      '<label>Farm or organisation <span>(optional)</span><input name="business_name" maxlength="120" autocomplete="organization" placeholder="Farm / business name"></label>'+
      '<label>Town or state <span>(optional)</span><input name="location" maxlength="100" placeholder="e.g. Abeokuta, Ogun"></label>'+
      '<label>Topic<select name="category"><option>General experience</option><option>Products and equipment</option><option>Poultry feeds and livestock</option><option>Farm setup and technical support</option><option>Customer service</option><option>Training and community</option><option>Partnership and supply</option><option>Question for Agrolyst</option></select></label>'+
      '<label class="agr-full">Your review or comment *<textarea name="body" required minlength="10" maxlength="2000" rows="4" placeholder="What would you like other farmers or customers to know?"></textarea><small class="agr-count" data-count>0 / 2000</small></label></div>'+
      '<label class="agr-consent"><input type="checkbox" name="consent" required><span>I agree to post this message publicly on Agrolyst’s website. I will not share private information or content that I do not have permission to publish.</span></label>'+
      '<div class="agr-compose-actions"><button class="agr-btn agr-btn--primary" type="submit">Post to community '+icon('send')+'</button><span data-status aria-live="polite">Please be respectful. Spam and abusive content may be hidden.</span></div></form>'+
      '<div class="agr-feed-head"><div><h3>Community conversation</h3><p data-summary>Loading the latest posts…</p></div><label class="agr-sort-label">Sort by<select data-sort><option value="newest">Newest</option><option value="popular">Most liked</option><option value="saved">Saved by me</option></select></label></div>'+
      '<div class="agr-feed" data-feed><div class="agr-loading"><span class="agr-spinner"></span>Loading community posts…</div></div>'+
      '<button class="agr-btn agr-btn--quiet agr-load-more" data-load-more type="button" hidden>Load more posts</button>'+
      '</section><aside class="agr-sidebar"><div class="agr-side-card agr-side-card--green"><div class="agr-side-icon">'+icon('heart')+'</div><h3>Good farming grows through shared knowledge.</h3><p>Share a useful experience, answer a question, or thank someone whose contribution helped you.</p><a href="https://wa.me/2349160008433?text=Hello%20Agrolyst%2C%20I%20need%20help." target="_blank" rel="noopener noreferrer">Talk to Agrolyst ↗</a></div>'+
      '<div class="agr-side-card"><div class="agr-side-icon">'+icon('bookmark')+'</div><h3>Keep useful posts close</h3><p>Use Save on any post to keep it in your saved list on this browser. Saved posts are private to this device.</p></div>'+
      '<div class="agr-side-card"><h3>Community guidelines</h3><ul><li>Be honest and constructive.</li><li>Respect other people and businesses.</li><li>Never post phone numbers, addresses or private details without consent.</li><li>Reviews are community posts, not official promises or guarantees from Agrolyst.</li></ul></div></aside></div></div>';
    const status = root.querySelector('[data-status]');
    const feed = root.querySelector('[data-feed]');
    const summary = root.querySelector('[data-summary]');
    const sort = root.querySelector('[data-sort]');
    const loadMore = root.querySelector('[data-load-more]');
    const visitorId = getVisitorId();
    let client = null, posts = [], comments = [], likes = [], shown = limit, loading = false;
    const likedSet = new Set(), savedSet = new Set(readList(SAVED_KEY));
    const setStatus = (message, error) => { status.textContent = message; status.classList.toggle('is-error', !!error); };
    function commentMarkup(comment, children, depth) {
      const avatar = esc((comment.author_name || '?').trim().charAt(0).toUpperCase());
      return '<article class="agr-comment" data-comment="'+comment.id+'"><div class="agr-avatar">'+avatar+'</div><div class="agr-comment-body"><div class="agr-comment-meta"><strong>'+esc(comment.author_name)+'</strong><time>'+esc(shortDate(comment.created_at))+'</time></div><p>'+esc(comment.body)+'</p><button class="agr-text-action" type="button" data-reply="'+comment.id+'">Reply</button>'+
      '<form class="agr-reply-form" data-reply-form="'+comment.id+'" hidden><label class="agr-sr-only" for="agr-reply-'+comment.id+'">Reply to '+esc(comment.author_name)+'</label><textarea id="agr-reply-'+comment.id+'" name="body" rows="2" maxlength="1000" required minlength="2" placeholder="Write a thoughtful reply…"></textarea><div class="agr-reply-actions"><input name="author_name" maxlength="80" minlength="2" required placeholder="Your name" aria-label="Your name"><button class="agr-btn agr-btn--small" type="submit">Reply</button><button class="agr-text-action" type="button" data-cancel-reply="'+comment.id+'">Cancel</button></div><p class="agr-inline-status" aria-live="polite"></p></form>'+
      (children.length && depth < 3 ? '<div class="agr-replies">'+children.map(c=>commentMarkup(c,comments.filter(x=>x.parent_id===c.id),depth+1)).join('')+'</div>' : '')+'</div></article>';
    }
    function render() {
      const mode = sort.value;
      let list = posts.filter(p=>!p.is_hidden);
      if(mode==='saved') list=list.filter(p=>savedSet.has(p.id));
      if(mode==='popular') list.sort((a,b)=>(likes.filter(x=>x.review_id===b.id).length-likes.filter(x=>x.review_id===a.id).length)||new Date(b.created_at)-new Date(a.created_at));
      else list.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
      const total = list.length;
      list = list.slice(0,shown);
      summary.textContent = total+' '+(total===1?'post':'posts')+(mode==='saved'?' saved on this browser':'')+' · '+comments.length+' replies';
      loadMore.hidden = total <= shown;
      if (!list.length) {
        feed.innerHTML = '<div class="agr-empty"><div>'+icon(mode==='saved'?'bookmark':'message')+'</div><h4>'+(mode==='saved'?'No saved posts yet':'Be the first to start the conversation')+'</h4><p>'+(mode==='saved'?'Save a post using the bookmark button and it will appear here on this browser.':'Share a helpful experience, question or comment using the form above.')+'</p></div>';
        return;
      }
      feed.innerHTML = list.map(post=>{
        const postComments=comments.filter(c=>c.review_id===post.id && !c.is_hidden);
        const roots=postComments.filter(c=>!c.parent_id);
        const postLikes=likes.filter(l=>l.review_id===post.id);
        const ownLike=likedSet.has(post.id);
        const avatar=esc((post.author_name||'?').trim().charAt(0).toUpperCase());
        return '<article class="agr-post" data-post="'+post.id+'"><div class="agr-post-head"><div class="agr-avatar">'+avatar+'</div><div class="agr-post-by"><strong>'+esc(post.author_name)+'</strong><span>'+esc([post.business_name,post.location].filter(Boolean).join(' · ')||'Agrolyst community member')+'</span></div><time>'+esc(shortDate(post.created_at))+'</time></div>'+
        '<div class="agr-post-category">'+esc(post.category||'Community')+'</div><p class="agr-post-copy">'+esc(post.body).replace(/\n/g,'<br>')+'</p>'+
        '<div class="agr-post-actions"><button class="agr-action '+(ownLike?'is-active':'')+'" type="button" data-like="'+post.id+'" '+(ownLike?'disabled':'')+' aria-label="'+(ownLike?'You liked this post':'Like this post')+'">'+icon('heart')+' <span>'+(postLikes.length)+' Like'+(postLikes.length===1?'':'s')+'</span></button><button class="agr-action" type="button" data-toggle-comments="'+post.id+'">'+icon('message')+' <span>'+postComments.length+' '+(postComments.length===1?'reply':'replies')+'</span></button><button class="agr-action agr-save '+(savedSet.has(post.id)?'is-active':'')+'" type="button" data-save="'+post.id+'">'+icon('bookmark')+' <span>'+(savedSet.has(post.id)?'Saved':'Save')+'</span></button></div>'+
        '<div class="agr-comments" data-comments-for="'+post.id+'"><div class="agr-comments-list">'+roots.map(c=>commentMarkup(c,postComments.filter(x=>x.parent_id===c.id),0)).join('')+'</div>'+
        '<form class="agr-comment-form" data-comment-form="'+post.id+'"><label class="agr-sr-only" for="agr-comment-name-'+post.id+'">Your name</label><input id="agr-comment-name-'+post.id+'" name="author_name" required minlength="2" maxlength="80" placeholder="Your name"><label class="agr-sr-only" for="agr-comment-body-'+post.id+'">Write a reply</label><textarea id="agr-comment-body-'+post.id+'" name="body" required minlength="2" maxlength="1000" rows="2" placeholder="Join the conversation…"></textarea><button class="agr-btn agr-btn--small" type="submit">Comment</button><p class="agr-inline-status" aria-live="polite"></p></form></div></article>';
      }).join('');
    }
    async function refresh() {
      if (!client || loading) return;
      loading=true;
      try {
        const [postRes,commentRes] = await Promise.all([
          client.from('agrolyst_reviews').select('id,author_name,business_name,location,category,body,is_hidden,created_at').eq('is_hidden',false).order('created_at',{ascending:false}).limit(250),
          client.from('agrolyst_review_comments').select('id,review_id,parent_id,author_name,body,is_hidden,created_at').eq('is_hidden',false).order('created_at',{ascending:true}).limit(1000)
        ]);
        if(postRes.error) throw postRes.error;
        if(commentRes.error) throw commentRes.error;
        posts=postRes.data||[]; comments=commentRes.data||[];
        const ids=posts.map(p=>p.id);
        if(ids.length){
          const [likeRes, ownLikeRes]=await Promise.all([client.from('agrolyst_review_likes').select('review_id').in('review_id',ids),client.from('agrolyst_review_likes').select('review_id').eq('visitor_id',visitorId).in('review_id',ids)]);
          if(likeRes.error) throw likeRes.error;
          if(ownLikeRes.error) throw ownLikeRes.error;
          likes=likeRes.data||[];
          likedSet.clear();(ownLikeRes.data||[]).forEach(row=>likedSet.add(row.review_id));
        } else likes=[];
        render();
      } catch(err) {
        feed.innerHTML='<div class="agr-empty"><h4>Community posts could not load</h4><p>Please refresh the page in a moment. If this continues, contact the Agrolyst team.</p></div>';
        summary.textContent='Unable to load posts right now.';
        console.error('Agrolyst reviews:',err);
      } finally { loading=false; }
    }
    function replyFormFor(id) { const form=root.querySelector('[data-reply-form="'+id+'"]'); if(form){form.hidden=!form.hidden;if(!form.hidden)form.querySelector('textarea').focus();} }
    root.addEventListener('input', e=>{ if(e.target.matches('[data-form="review"] textarea')) { const counter=root.querySelector('[data-count]'); if(counter)counter.textContent=e.target.value.length+' / 2000'; } });
    root.addEventListener('change',e=>{if(e.target===sort){shown=limit;render();}});
    root.addEventListener('click',async e=>{
      const likeBtn=e.target.closest('[data-like]');
      if(likeBtn){const id=likeBtn.dataset.like;if(likeBtn.disabled)return;likeBtn.disabled=true;const {error}=await client.from('agrolyst_review_likes').insert({review_id:id,visitor_id:visitorId});if(error){setStatus(error.code==='23505'?'You have already liked this post.':'Could not save your like. Please try again.',true);}else{setStatus('Your like has been added.');await refresh();}return;}
      const saveBtn=e.target.closest('[data-save]');
      if(saveBtn){const id=saveBtn.dataset.save;if(savedSet.has(id))savedSet.delete(id);else savedSet.add(id);try{localStorage.setItem(SAVED_KEY,JSON.stringify([...savedSet]));}catch(_){}render();return;}
      const toggle=e.target.closest('[data-toggle-comments]');if(toggle){const panel=root.querySelector('[data-comments-for="'+toggle.dataset.toggleComments+'"]');if(panel)panel.classList.toggle('is-open');return;}
      const reply=e.target.closest('[data-reply]');if(reply){replyFormFor(reply.dataset.reply);return;}
      const cancel=e.target.closest('[data-cancel-reply]');if(cancel){const form=root.querySelector('[data-reply-form="'+cancel.dataset.cancelReply+'"]');if(form)form.hidden=true;}
    });
    root.addEventListener('submit',async e=>{
      const form=e.target;
      if(form.matches('[data-form="review"]')){
        e.preventDefault();if(!form.reportValidity())return;
        const fd=new FormData(form), body=String(fd.get('body')||'').trim();
        if(body.length<10){setStatus('Please write at least 10 characters so your post is useful.',true);return;}
        const button=form.querySelector('button[type="submit"]');button.disabled=true;setStatus('Posting your message…');
        const {error}=await client.from('agrolyst_reviews').insert({author_name:String(fd.get('author_name')).trim(),business_name:String(fd.get('business_name')||'').trim()||null,location:String(fd.get('location')||'').trim()||null,category:String(fd.get('category')||'General experience'),body,visitor_id:visitorId});
        button.disabled=false;
        if(error){setStatus('Your post could not be published. Please try again shortly.',true);console.error(error);return;}
        form.reset();const count=root.querySelector('[data-count]');if(count)count.textContent='0 / 2000';setStatus('Thanks — your post is now part of the Agrolyst community.');shown=limit;sort.value='newest';await refresh();return;
      }
      const postForm=form.closest('[data-comment-form]');
      if(postForm){e.preventDefault();if(!postForm.reportValidity())return;const id=postForm.dataset.commentForm,fd=new FormData(postForm),body=String(fd.get('body')||'').trim(),inline=postForm.querySelector('.agr-inline-status');const button=postForm.querySelector('button[type="submit"]');button.disabled=true;inline.textContent='Sending reply…';
        const {error}=await client.from('agrolyst_review_comments').insert({review_id:id,parent_id:null,author_name:String(fd.get('author_name')).trim(),body,visitor_id:visitorId});button.disabled=false;
        if(error){inline.textContent='Could not post this reply. Please try again.';console.error(error);return;}await refresh();const panel=root.querySelector('[data-comments-for="'+id+'"]');if(panel)panel.classList.add('is-open');return;
      }
      const replyForm=form.closest('[data-reply-form]');
      if(replyForm){e.preventDefault();if(!replyForm.reportValidity())return;const parent=replyForm.dataset.replyForm;const article=replyForm.closest('[data-post]');const id=article?article.dataset.post:replyForm.closest('[data-comment]')?.closest('[data-post]')?.dataset.post;if(!id)return;const fd=new FormData(replyForm),body=String(fd.get('body')||'').trim(),inline=replyForm.querySelector('.agr-inline-status'),button=replyForm.querySelector('button[type="submit"]');button.disabled=true;inline.textContent='Sending reply…';
        const {error}=await client.from('agrolyst_review_comments').insert({review_id:id,parent_id:parent,author_name:String(fd.get('author_name')).trim(),body,visitor_id:visitorId});button.disabled=false;
        if(error){inline.textContent='Could not post this reply. Please try again.';console.error(error);return;}await refresh();const panel=root.querySelector('[data-comments-for="'+id+'"]');if(panel)panel.classList.add('is-open');return;
      }
    });
    loadMore.addEventListener('click',()=>{shown+=limit;render();});
    sort.addEventListener('change',()=>{if(sort.value==='saved')shown=Math.max(limit,savedSet.size);});
    if(!window.supabase || typeof window.supabase.createClient!=='function'){
      feed.innerHTML='<div class="agr-empty"><h4>Community connection unavailable</h4><p>Please refresh the page or contact Agrolyst if the issue continues.</p></div>';return;
    }
    client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
    client.channel('agrolyst-community-reviews')
      .on('postgres_changes',{event:'*',schema:'public',table:'agrolyst_reviews'},()=>refresh())
      .on('postgres_changes',{event:'*',schema:'public',table:'agrolyst_review_comments'},()=>refresh())
      .on('postgres_changes',{event:'*',schema:'public',table:'agrolyst_review_likes'},()=>refresh())
      .subscribe();
    refresh();
  }
  function boot(){document.querySelectorAll('[data-agrolyst-reviews]').forEach(init);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
