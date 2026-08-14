using System.Diagnostics;
using System.Windows;
using System.Windows.Input;
using PlansyncRevitPlugin.Services;
using PlansyncRevitPlugin.Services.Api;
using PlansyncRevitPlugin.Services.Auth;

namespace PlansyncRevitPlugin.UI
{
    public partial class LoginWindow : Window
    {
        private readonly PlansyncAuthClient _auth = new();

        public LoginWindow()
        {
            InitializeComponent();
            WindowOwnerHelper.SetRevitAsOwner(this);
            LogoImage.Source = IconLoader.Load("logo_mark_48.png");
        }

        public MeResponse? SignedInMe { get; private set; }

        private async void SignIn_Click(object sender, RoutedEventArgs e)
        {
            HideError();
            string email = EmailBox.Text.Trim();
            string password = PasswordBox.Password;

            if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
            {
                ShowError("Enter your email and password.");
                return;
            }

            SignInButton.IsEnabled = false;
            SignInButton.Content = "Please wait…";

            try
            {
                SignedInMe = await _auth.SignInAsync(email, password).ConfigureAwait(true);
                PlansyncSessionState.Me = SignedInMe;
                PublishStatusHub.Notify($"Signed in as {SignedInMe.User?.Email}");
                DialogResult = true;
            }
            catch (PlansyncAuthException ex)
            {
                ShowError(ex.Message);
            }
            catch (Exception ex)
            {
                ShowError(ex.Message);
            }
            finally
            {
                SignInButton.IsEnabled = true;
                SignInButton.Content = "Sign in";
            }
        }

        private void ForgotPassword_Click(object sender, MouseButtonEventArgs e) =>
            OpenBrowser($"{PlansyncConfig.BaseUrl}/forgot-password");

        private void CreateAccount_Click(object sender, RoutedEventArgs e) =>
            OpenBrowser($"{PlansyncConfig.BaseUrl}/sign-in?mode=sign-up");

        private void Home_Click(object sender, RoutedEventArgs e) =>
            OpenBrowser(PlansyncConfig.BaseUrl);

        private void Window_PreviewKeyDown(object sender, KeyEventArgs e)
        {
            if (e.Key == Key.Escape)
            {
                DialogResult = false;
                e.Handled = true;
            }
        }

        private void ShowError(string message)
        {
            ErrorText.Text = message;
            ErrorBanner.Visibility = Visibility.Visible;
        }

        private void HideError()
        {
            ErrorBanner.Visibility = Visibility.Collapsed;
            ErrorText.Text = string.Empty;
        }

        private static void OpenBrowser(string url)
        {
            Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
        }
    }
}
