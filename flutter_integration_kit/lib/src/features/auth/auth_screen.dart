import 'package:flutter/material.dart';

import 'session_controller.dart';

class AuthScreen extends StatefulWidget {
  const AuthScreen({
    super.key,
    required this.sessionController,
  });

  final SessionController sessionController;

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;
  final _loginFormKey = GlobalKey<FormState>();
  final _registerFormKey = GlobalKey<FormState>();

  final _loginEmailController = TextEditingController();
  final _loginPasswordController = TextEditingController();
  final _registerNameController = TextEditingController();
  final _registerEmailController = TextEditingController();
  final _registerPasswordController = TextEditingController();
  final _registerConfirmController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _loginEmailController.dispose();
    _loginPasswordController.dispose();
    _registerNameController.dispose();
    _registerEmailController.dispose();
    _registerPasswordController.dispose();
    _registerConfirmController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isBusy = widget.sessionController.isBusy;

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 12),
              child: Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [
                      Color(0xFF164F4C),
                      Color(0xFF1F716D),
                    ],
                  ),
                  borderRadius: BorderRadius.circular(28),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const CircleAvatar(
                      radius: 28,
                      backgroundColor: Colors.white24,
                      child: Icon(
                        Icons.inventory_2_outlined,
                        color: Colors.white,
                        size: 28,
                      ),
                    ),
                    const SizedBox(height: 18),
                    Text(
                      'Welcome to AI Rent',
                      style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.w800,
                          ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      'Browse listings as a guest, or sign in to save favorites, request rentals, manage listings, and keep up with notifications.',
                      style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                            color: Colors.white.withOpacity(0.88),
                          ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          SliverFillRemaining(
            hasScrollBody: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
              child: Card(
                child: Padding(
                  padding: const EdgeInsets.all(18),
                  child: Column(
                    children: [
                      Container(
                        decoration: BoxDecoration(
                          color: Colors.black.withOpacity(0.04),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: TabBar(
                          controller: _tabController,
                          indicator: BoxDecoration(
                            color: Theme.of(context).colorScheme.primary,
                            borderRadius: BorderRadius.circular(14),
                          ),
                          labelColor: Colors.white,
                          unselectedLabelColor: Colors.black87,
                          dividerColor: Colors.transparent,
                          tabs: const [
                            Tab(text: 'Sign in'),
                            Tab(text: 'Create account'),
                          ],
                        ),
                      ),
                      const SizedBox(height: 20),
                      Expanded(
                        child: TabBarView(
                          controller: _tabController,
                          children: [
                            _buildLoginForm(context, isBusy),
                            _buildRegisterForm(context, isBusy),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLoginForm(BuildContext context, bool isBusy) {
    return Form(
      key: _loginFormKey,
      child: ListView(
        children: [
          Text(
            'Sign in',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
          ),
          const SizedBox(height: 8),
          Text(
            'Use your account to save listings, request rentals, and manage your profile.',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Colors.black.withOpacity(0.65),
                ),
          ),
          const SizedBox(height: 18),
          TextFormField(
            controller: _loginEmailController,
            decoration: const InputDecoration(labelText: 'Email'),
            keyboardType: TextInputType.emailAddress,
            validator: _requiredValidator,
          ),
          const SizedBox(height: 14),
          TextFormField(
            controller: _loginPasswordController,
            decoration: const InputDecoration(labelText: 'Password'),
            obscureText: true,
            validator: _requiredValidator,
          ),
          const SizedBox(height: 20),
          FilledButton(
            onPressed: isBusy ? null : _submitLogin,
            child: Text(isBusy ? 'Signing in...' : 'Sign in'),
          ),
        ],
      ),
    );
  }

  Widget _buildRegisterForm(BuildContext context, bool isBusy) {
    return Form(
      key: _registerFormKey,
      child: ListView(
        children: [
          Text(
            'Create account',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
          ),
          const SizedBox(height: 8),
          Text(
            'You can start as a renter and the backend will upgrade your role automatically when you create a listing later.',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Colors.black.withOpacity(0.65),
                ),
          ),
          const SizedBox(height: 18),
          TextFormField(
            controller: _registerNameController,
            decoration: const InputDecoration(labelText: 'Full name'),
            validator: _requiredValidator,
          ),
          const SizedBox(height: 14),
          TextFormField(
            controller: _registerEmailController,
            decoration: const InputDecoration(labelText: 'Email'),
            keyboardType: TextInputType.emailAddress,
            validator: _requiredValidator,
          ),
          const SizedBox(height: 14),
          TextFormField(
            controller: _registerPasswordController,
            decoration: const InputDecoration(labelText: 'Password'),
            obscureText: true,
            validator: _requiredValidator,
          ),
          const SizedBox(height: 14),
          TextFormField(
            controller: _registerConfirmController,
            decoration: const InputDecoration(labelText: 'Confirm password'),
            obscureText: true,
            validator: (value) {
              if ((value ?? '').trim().isEmpty) {
                return 'This field is required';
              }
              if (value != _registerPasswordController.text) {
                return 'Passwords do not match';
              }
              return null;
            },
          ),
          const SizedBox(height: 20),
          FilledButton(
            onPressed: isBusy ? null : _submitRegister,
            child: Text(isBusy ? 'Creating account...' : 'Create account'),
          ),
        ],
      ),
    );
  }

  Future<void> _submitLogin() async {
    if (!_loginFormKey.currentState!.validate()) {
      return;
    }

    final result = await widget.sessionController.login(
      email: _loginEmailController.text.trim(),
      password: _loginPasswordController.text,
    );

    _showResult(result, successMessage: 'Signed in successfully.');
  }

  Future<void> _submitRegister() async {
    if (!_registerFormKey.currentState!.validate()) {
      return;
    }

    final result = await widget.sessionController.register(
      name: _registerNameController.text.trim(),
      email: _registerEmailController.text.trim(),
      password: _registerPasswordController.text,
      confirmPassword: _registerConfirmController.text,
    );

    _showResult(result, successMessage: 'Account created successfully.');
  }

  void _showResult(String? message, {required String successMessage}) {
    if (!mounted) {
      return;
    }

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message ?? successMessage),
      ),
    );
  }

  String? _requiredValidator(String? value) {
    if ((value ?? '').trim().isEmpty) {
      return 'This field is required';
    }

    return null;
  }
}
