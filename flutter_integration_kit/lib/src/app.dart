import 'dart:convert';

import 'package:flutter/material.dart';

import 'config/app_dependencies.dart';

class IntegrationStarterApp extends StatelessWidget {
  const IntegrationStarterApp({
    super.key,
    required this.dependencies,
  });

  final AppDependencies dependencies;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'AI Rent Flutter Integration',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF155EEF)),
        useMaterial3: true,
      ),
      home: IntegrationStarterHome(dependencies: dependencies),
    );
  }
}

class IntegrationStarterHome extends StatefulWidget {
  const IntegrationStarterHome({
    super.key,
    required this.dependencies,
  });

  final AppDependencies dependencies;

  @override
  State<IntegrationStarterHome> createState() => _IntegrationStarterHomeState();
}

class _IntegrationStarterHomeState extends State<IntegrationStarterHome> {
  bool _isLoading = false;
  String _output = 'Ready. Use the buttons below to smoke-test the public API.';

  Future<void> _run(String label, Future<Map<String, dynamic>> Function() action) async {
    setState(() {
      _isLoading = true;
      _output = '$label...';
    });

    try {
      final result = await action();
      const encoder = JsonEncoder.withIndent('  ');

      setState(() {
        _output = encoder.convert(result);
      });
    } catch (error) {
      setState(() {
        _output = error.toString();
      });
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('AI Rent Integration Starter'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Base URL',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 8),
                    SelectableText(widget.dependencies.config.baseUrl),
                    const SizedBox(height: 8),
                    const Text(
                      'These starter buttons hit public endpoints so you can verify connectivity before wiring auth and protected screens.',
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            Wrap(
              spacing: 12,
              runSpacing: 12,
              children: [
                FilledButton(
                  onPressed: _isLoading
                      ? null
                      : () => _run(
                            'Loading categories',
                            widget.dependencies.categories.listCategories,
                          ),
                  child: const Text('Load categories'),
                ),
                OutlinedButton(
                  onPressed: _isLoading
                      ? null
                      : () => _run(
                            'Loading products',
                            () => widget.dependencies.products.listProducts(limit: 5),
                          ),
                  child: const Text('Load products'),
                ),
                OutlinedButton(
                  onPressed: _isLoading
                      ? null
                      : () => _run(
                            'Loading OpenAPI info',
                            widget.dependencies.apiClient.fetchOpenApiDocument,
                          ),
                  child: const Text('Load OpenAPI'),
                ),
              ],
            ),
            const SizedBox(height: 16),
            if (_isLoading) const LinearProgressIndicator(),
            const SizedBox(height: 16),
            Expanded(
              child: Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: SingleChildScrollView(
                    child: SelectableText(_output),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
