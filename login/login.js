document.addEventListener('DOMContentLoaded', () => {

    const usernameInput = document.querySelector('input[type="text"]');
    const passwordInput = document.querySelector('input[type="password"]');
    const togglePasswordBtn = passwordInput.nextElementSibling; // כפתור העין
    const submitBtn = document.querySelector('.btn-submit');
    const loginForm = document.querySelector('.login-form');


    function togglePasswordVisibility() 
    {
        const STATE_HIDDEN = 'password';
        const STATE_VISIBLE = 'text';
        const currentType = passwordInput.getAttribute('type');
        const isPasswordHidden = currentType === STATE_HIDDEN;
        const nextType = isPasswordHidden ? STATE_VISIBLE : STATE_HIDDEN;
        passwordInput.setAttribute('type', nextType);
        togglePasswordBtn.style.opacity = isPasswordHidden ? '0.6' : '1';
    }

   
    function removeExistingMessage() 
    {
        const existingMsg = document.querySelector('.form-message');
        if (existingMsg) {
            existingMsg.remove();
        }
    }
    
  
    function showMessage(text, type) {
        removeExistingMessage();

        const messageDiv = document.createElement('div');
        messageDiv.className = `form-message ${type}`;
        
        messageDiv.innerHTML = DOMPurify.sanitize(text);
        
        messageDiv.style.position = 'absolute';
        messageDiv.style.bottom = '-55px'; 
        messageDiv.style.left = '0';
        messageDiv.style.right = '0';
        messageDiv.style.zIndex = '10';
        
        messageDiv.style.padding = '10px';
        messageDiv.style.borderRadius = '6px';
        messageDiv.style.textAlign = 'center';
        messageDiv.style.fontSize = '14px';
        messageDiv.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
        
        if (type === 'error') 
        {
            messageDiv.style.backgroundColor = '#fee2e2';
            messageDiv.style.color = '#dc2626';
        } 
        else 
        {
            messageDiv.style.backgroundColor = '#dcfce7';
            messageDiv.style.color = '#16a34a';
        }

        loginForm.style.position = 'relative';
        loginForm.appendChild(messageDiv);
    }

    
    function handleLogin(e) {
        e.preventDefault(); // מניעת רענון עמוד

        // ניקוי הקלט באמצעות DOMPurify והסרת רווחים מיותרים
        const rawUsername = usernameInput.value.trim();
        const rawPassword = passwordInput.value.trim();

        const cleanUsername = DOMPurify.sanitize(rawUsername);
        const cleanPassword = DOMPurify.sanitize(rawPassword);

        if (cleanUsername === '' || cleanPassword === '') 
        {
            showMessage('נא למלא את כל השדות', 'error');
            return;
        }

        // --- בדיקה בסיסית זמנית (עד לחיבור ל-DB) ---
        // כאן אתה יכול להגדיר שחקו-משתמש וסיסמה לבדיקה מקומית
        const mockValidUsername = 'admin';
        const mockValidPassword = '123456';

        if (cleanUsername === mockValidUsername && cleanPassword === mockValidPassword) 
        {
            showMessage('ההתחברות בוצעה בהצלחה!', 'success');
            
            // בהמשך, כשתחבר ל-DB, תוכל לבצע כאן קריאת fetch לשרת:
            // fetch('/api/login', { method: 'POST', body: JSON.stringify({ cleanUsername, cleanPassword }) ... })
        } 
        else 
        {
            showMessage('שם המשתמש או הסיסמה שגויים', 'error');
        }
    }


    togglePasswordBtn.style.cursor = 'pointer';
    togglePasswordBtn.addEventListener('click', togglePasswordVisibility);
    
    submitBtn.addEventListener('click', handleLogin);
    

});