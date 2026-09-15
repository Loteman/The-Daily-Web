export class LoginView 
{
    constructor() 
    {
        this.usernameInput = document.querySelector('input[type="text"]');
        this.passwordInput = document.querySelector('input[type="password"]');
        this.togglePasswordBtn = this.passwordInput.nextElementSibling;
        this.submitBtn = document.querySelector('.btn-submit');
        this.loginForm = document.querySelector('.login-form');
        
        this.initFormPosition();
    }

    // לוודא שהטופס תומך בהודעות absolute
    initFormPosition() 
    {
        this.loginForm.style.position = 'relative';
    }

    getUsername() 
    {
        return this.usernameInput.value.trim();
    }

    getPassword() 
    {
        return this.passwordInput.value.trim();
    }

    setPasswordType(type) 
    {
        this.passwordInput.setAttribute('type', type);
    }

    getPasswordType() 
    {
        return this.passwordInput.getAttribute('type');
    }

    setToggleIconOpacity(opacity) 
    {
        this.togglePasswordBtn.style.opacity = opacity;
        this.togglePasswordBtn.style.cursor = 'pointer';
    }

    removeMessage() 
    {
        const existingMsg = document.querySelector('.form-message');
        if (existingMsg) existingMsg.remove();
    }

    showMessage(text, type) 
    {
        this.removeMessage();

        const messageDiv = document.createElement('div');
        messageDiv.className = `form-message ${type}`;
        
        // שימוש ב-DOMPurify לאבטחה
        messageDiv.innerHTML = DOMPurify.sanitize(text);
        
        // עיצוב הודעה
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

        this.loginForm.appendChild(messageDiv);
    }

    // הוספת מאזינים לאירועים ושליחתם הלאה ל-Controller
    bindTogglePassword(handler) 
    {
        this.togglePasswordBtn.addEventListener('click', handler);
    }

    bindLoginSubmit(handler) 
    {
        this.submitBtn.addEventListener('click', handler);
    }
}