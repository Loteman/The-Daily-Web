export class LoginController 
{
    constructor(model, view) 
    {
        this.model = model;
        this.view = view;

        // Wire up events from the View to Controller functions
        this.view.bindTogglePassword(this.handleTogglePassword.bind(this));
        this.view.bindLoginSubmit(this.handleLoginSubmit.bind(this));
    }

    handleTogglePassword() 
    {
        const STATE_HIDDEN = 'password';
        const STATE_VISIBLE = 'text';
        
        const currentType = this.view.getPasswordType();
        const isHidden = currentType === STATE_HIDDEN;
        
        const nextType = isHidden ? STATE_VISIBLE : STATE_HIDDEN;
        
        this.view.setPasswordType(nextType);
        this.view.setToggleIconOpacity(isHidden ? '1' : '0.6');
    }

    async handleLoginSubmit(e) 
    {
        e.preventDefault();

        const rawUsername = this.view.getUsername();
        const rawPassword = this.view.getPassword();

        // Validate input before passing to the Model
        const cleanUsername = rawUsername.trim();
        const cleanPassword = rawPassword;

        if (!cleanUsername || !cleanPassword) 
        {
            this.view.showMessage('נא למלא את כל השדות', 'error');
            return;
        }

        // Ask the Model to validate the data
        const result = await this.model.validateCredentials(cleanUsername, cleanPassword);

        // Update the View according to the Model's response
        if (result.success) 
        {
            sessionStorage.removeItem('username');
            sessionStorage.removeItem('role');
            window.location.href = '../articlesFeed/index.html';
        }
        else 
            this.view.showMessage(result.message, 'error');
        
    }
}
