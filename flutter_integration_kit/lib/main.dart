import 'package:flutter/material.dart';

import 'src/app.dart';
import 'src/config/app_dependencies.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final dependencies = await AppDependencies.bootstrap();
  runApp(IntegrationStarterApp(dependencies: dependencies));
}
