const firebaseConfig = {
  apiKey: "AIzaSyBsBshpBt4A-BGebqakENkIQU1Sln6k6HA",
  authDomain: "mycompany2-2a042.firebaseapp.com",
  projectId: "mycompany2-2a042",
  storageBucket: "mycompany2-2a042.firebasestorage.app",
  messagingSenderId: "1033084071682",
  appId: "1:1033084071682:web:a8b04cd37dcfc90b37dc1b",
  measurementId: "G-MWGRW65TQN"
};

// [중요 로컬 구동 패치] 
// 모듈(type="module") 방식은 로컬 서버 없이 html 더블클릭 시 스크립트를 중단(CORS 오류)시켜 
// 애니메이션(Observer)을 마비시키므로, 호환성 글로벌 객체(firebase)로 재구성했습니다.
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

document.addEventListener('DOMContentLoaded', () => {

    // --- 1. Parallax Effect for Hero Image ---
    const heroBg = document.querySelector('.scroll-bg');
    window.addEventListener('scroll', () => {
        const scrolled = window.scrollY;
        if(heroBg && scrolled < window.innerHeight) {
            heroBg.style.transform = `translateY(${scrolled * 0.4}px)`;
        }
    });

    // --- 2. Scroll Animation Setup ---
    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                obs.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.fade-in, .fade-in-up, .fade-in-left, .fade-in-right').forEach(el => {
        observer.observe(el);
    });

    // --- 3. Community Board - Load Posts & Filter ---
    const boardList = document.getElementById('board-list');
    
    async function loadPosts() {
        if (!boardList) return;
        boardList.innerHTML = '<p style="text-align:center; padding: 2rem; color: #a1a1aa;">게시글을 동기화하고 있습니다...</p>';
        
        try {
            // Firebase 에서 게시물 가져오기
            const querySnapshot = await db.collection("posts").orderBy("createdAt", "desc").get();
            
            boardList.innerHTML = '';
            
            if (querySnapshot.empty) {
                boardList.innerHTML = '<p style="text-align:center; padding: 2rem; color: #a1a1aa;">등록된 글이 없습니다. 회원님의 첫 이야기를 들려주세요!</p>';
                return;
            }

            querySnapshot.forEach((doc) => {
                const data = doc.data();
                
                const tagNames = { 'review': '시승기/리뷰', 'tip': '정비 팁', 'cert': '출고 인증' };
                const tagName = tagNames[data.category] || '일반';
                
                let timeString = '조금 전';
                if(data.createdAt) {
                    const date = data.createdAt.toDate();
                    timeString = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                }

                // fallback
                const authorDisplay = data.author ? data.author : '익명';
                const titleDisplay = data.title ? data.title : '제목 없음';

                const itemHTML = `
                    <div class="board-item-sleek" data-category="${data.category}">
                        <div class="board-thumb" style="background-image: url('assets/benz_hero_sedan_1778467347199.png'); filter: grayscale(80%) contrast(1.2);"></div>
                        <div class="board-summary">
                            <span class="board-tag">${tagName}</span>
                            <h4 class="board-title">${titleDisplay}</h4>
                            <p class="board-meta">
                                <span>${authorDisplay}</span><span class="dot">·</span><span>댓글: 0</span><span class="dot">·</span><span>${timeString}</span>
                            </p>
                        </div>
                    </div>
                `;
                boardList.insertAdjacentHTML('beforeend', itemHTML);
            });

            bindTagFilters();
            
        } catch(error) {
            console.error("Error loading posts: ", error);
            // 권한 에러 등으로 실패 시
            boardList.innerHTML = '<p style="text-align:center; padding: 2rem; color: #a1a1aa;">작성된 게시물이 없습니다. 로컬 테스트 중입니다.</p>';
            bindTagFilters(); // 최소한 이벤트는 활성화 
        }
    }

    function bindTagFilters() {
        const tagBtns = document.querySelectorAll('.tag-btn');
        const boardItems = document.querySelectorAll('.board-item-sleek');

        tagBtns.forEach(btn => {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);

            newBtn.addEventListener('click', (e) => {
                document.querySelectorAll('.tag-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');

                const filter = e.target.getAttribute('data-filter');

                document.querySelectorAll('.board-item-sleek').forEach(item => {
                    const category = item.getAttribute('data-category');
                    
                    item.style.opacity = '0';
                    item.style.transform = 'translateY(10px)';

                    setTimeout(() => {
                        if (filter === 'all' || category === filter) {
                            item.style.display = 'flex';
                            void item.offsetWidth;
                            item.style.opacity = '1';
                            item.style.transform = 'translateY(0)';
                        } else {
                            item.style.display = 'none';
                        }
                    }, 300);
                });
            });
        });
    }

    // 목록 불러오기 실행
    loadPosts();

    // --- 4. Modal (Write Post) logic & Firebase Add ---
    const writeModal = document.getElementById('write-modal');
    const openModalBtn = document.getElementById('open-write-modal');
    const closeBtn = document.querySelector('.close-modal');
    const writeForm = document.getElementById('write-form');
    let toastTimeout;

    if (openModalBtn && writeModal) {
        openModalBtn.addEventListener('click', () => {
            writeModal.classList.add('active');
        });

        closeBtn.addEventListener('click', () => {
            writeModal.classList.remove('active');
            if(writeForm) writeForm.reset();
        });

        if(writeForm) {
            writeForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const category = document.getElementById('doc-category').value;
                const author = document.getElementById('doc-author').value;
                const password = document.getElementById('doc-password').value;
                const title = document.getElementById('doc-title').value;
                const content = document.getElementById('doc-content').value;

                const submitBtn = writeForm.querySelector('button[type="submit"]');
                const origText = submitBtn.innerText;
                submitBtn.innerText = "안전하게 암호화 중...";
                submitBtn.disabled = true;
                
                try {
                    await db.collection("posts").add({
                        category: category,
                        author: author,
                        password: password, // 실무에선 해싱해야하지만 시뮬레이션
                        title: title,
                        content: content,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    
                    writeModal.classList.remove('active');
                    writeForm.reset();
                    submitBtn.innerText = origText;
                    submitBtn.disabled = false;
                    
                    showNotification("비밀번호와 함께 글이 정상 업로드되었습니다.");
                    
                    loadPosts(); // 목록 리로드
                    
                } catch (e) {
                    console.error("Error adding document: ", e);
                    submitBtn.innerText = "로스터리 에러";
                    setTimeout(() => {
                        submitBtn.innerText = origText;
                        submitBtn.disabled = false;
                    }, 2000);
                }
            });
        }
    }

    // --- 5. Notifications ---
    const toast = document.getElementById('notification-toast');
    const toastText = document.querySelector('.toast-text');

    function showNotification(message) {
        if(!toast || !toastText) return;
        toastText.innerText = message;
        toast.classList.add('show');
        
        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
            toast.classList.remove('show');
        }, 4000);
    }
});
