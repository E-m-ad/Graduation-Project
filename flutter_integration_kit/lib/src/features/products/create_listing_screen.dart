import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../config/app_dependencies.dart';
import '../../core/utils/json_utils.dart';
import '../../core/widgets/app_state_views.dart';
import '../auth/session_controller.dart';

class CreateListingScreen extends StatefulWidget {
  const CreateListingScreen({
    super.key,
    required this.dependencies,
    required this.sessionController,
    this.existingProduct,
  });

  final AppDependencies dependencies;
  final SessionController sessionController;
  final JsonMap? existingProduct;

  @override
  State<CreateListingScreen> createState() => _CreateListingScreenState();
}

class _CreateListingScreenState extends State<CreateListingScreen> {
  final _formKey = GlobalKey<FormState>();
  final _picker = ImagePicker();

  late final TextEditingController _titleController;
  late final TextEditingController _descriptionController;
  late final TextEditingController _cityController;
  late final TextEditingController _locationController;
  late final TextEditingController _priceHourController;
  late final TextEditingController _priceDayController;
  late final TextEditingController _priceWeekController;
  late final TextEditingController _priceMonthController;
  late final TextEditingController _depositController;
  late final TextEditingController _minPeriodController;
  late final TextEditingController _maxPeriodController;
  late final TextEditingController _tagsController;
  late final TextEditingController _termsController;

  bool _isLoading = true;
  bool _isSubmitting = false;
  String? _error;
  String? _selectedCategoryId;
  String _condition = 'good';
  List<JsonMap> _categories = const [];
  List<String> _selectedImages = [];

  bool get _isEditing => widget.existingProduct != null;

  @override
  void initState() {
    super.initState();

    final existing = widget.existingProduct;
    _titleController =
        TextEditingController(text: existing?.nullableString('title') ?? '');
    _descriptionController =
        TextEditingController(text: existing?.nullableString('description') ?? '');
    _cityController =
        TextEditingController(text: existing?.nullableString('city') ?? '');
    _locationController = TextEditingController(
      text: existing?.nullableString('locationAddress') ?? '',
    );
    _priceHourController = TextEditingController(
      text: existing?.doubleValue('pricePerHour')?.toString() ?? '',
    );
    _priceDayController = TextEditingController(
      text: existing?.doubleValue('pricePerDay')?.toString() ?? '',
    );
    _priceWeekController = TextEditingController(
      text: existing?.doubleValue('pricePerWeek')?.toString() ?? '',
    );
    _priceMonthController = TextEditingController(
      text: existing?.doubleValue('pricePerMonth')?.toString() ?? '',
    );
    _depositController = TextEditingController(
      text: existing?.doubleValue('securityDeposit')?.toString() ?? '',
    );
    _minPeriodController = TextEditingController(
      text: existing?.intValue('minRentalPeriod')?.toString() ?? '1',
    );
    _maxPeriodController = TextEditingController(
      text: existing?.intValue('maxRentalPeriod')?.toString() ?? '30',
    );
    _tagsController = TextEditingController(
      text: existing?.stringList('tags').join(', ') ?? '',
    );
    _termsController = TextEditingController(
      text: existing?.nullableString('termsConditions') ?? '',
    );
    _selectedCategoryId =
        existing?.nullableString('categoryId') ??
            existing?.json('category')?.nullableString('id');
    _condition = existing?.nullableString('condition') ?? 'good';

    _loadCategories();
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    _cityController.dispose();
    _locationController.dispose();
    _priceHourController.dispose();
    _priceDayController.dispose();
    _priceWeekController.dispose();
    _priceMonthController.dispose();
    _depositController.dispose();
    _minPeriodController.dispose();
    _maxPeriodController.dispose();
    _tagsController.dispose();
    _termsController.dispose();
    super.dispose();
  }

  Future<void> _loadCategories() async {
    try {
      final response = await widget.dependencies.categories.listCategories();
      final categories = asJsonMap(response['data'])?.jsonList('categories') ?? const [];

      setState(() {
        _categories = categories
            .where((category) => category.boolValue('isActive', fallback: true))
            .toList(growable: false);
        _selectedCategoryId ??=
            _categories.isEmpty ? null : _categories.first.string('id');
        _isLoading = false;
      });
    } catch (error) {
      setState(() {
        _error = error.toString();
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Scaffold(
        appBar: AppBar(
          title: Text(_isEditing ? 'Edit listing' : 'Create listing'),
        ),
        body: const AppLoadingView(label: 'Loading categories...'),
      );
    }

    if (_error != null) {
      return Scaffold(
        appBar: AppBar(
          title: Text(_isEditing ? 'Edit listing' : 'Create listing'),
        ),
        body: AppErrorState(
          message: _error!,
          onRetry: _loadCategories,
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(_isEditing ? 'Edit listing' : 'Create listing'),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 120),
          children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _isEditing ? 'Update your listing' : 'Share what you own',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                            fontWeight: FontWeight.w800,
                          ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Keep the form simple and clear. You can add photos now and upload more later.',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: Colors.black.withOpacity(0.65),
                          ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 18),
            DropdownButtonFormField<String>(
              value: _selectedCategoryId,
              decoration: const InputDecoration(labelText: 'Category'),
              items: _categories
                  .map(
                    (category) => DropdownMenuItem(
                      value: category.string('id'),
                      child: Text(category.string('name')),
                    ),
                  )
                  .toList(growable: false),
              onChanged: (value) {
                setState(() {
                  _selectedCategoryId = value;
                });
              },
              validator: (value) =>
                  value == null || value.isEmpty ? 'Choose a category' : null,
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: _titleController,
              decoration: const InputDecoration(labelText: 'Title'),
              validator: _requiredValidator,
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: _descriptionController,
              minLines: 4,
              maxLines: 5,
              decoration: const InputDecoration(labelText: 'Description'),
              validator: _requiredValidator,
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: _cityController,
                    decoration: const InputDecoration(labelText: 'City'),
                    validator: _requiredValidator,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: DropdownButtonFormField<String>(
                    value: _condition,
                    decoration: const InputDecoration(labelText: 'Condition'),
                    items: const [
                      DropdownMenuItem(value: 'new', child: Text('New')),
                      DropdownMenuItem(value: 'like_new', child: Text('Like new')),
                      DropdownMenuItem(value: 'excellent', child: Text('Excellent')),
                      DropdownMenuItem(value: 'good', child: Text('Good')),
                      DropdownMenuItem(value: 'fair', child: Text('Fair')),
                    ],
                    onChanged: (value) {
                      if (value == null) {
                        return;
                      }
                      setState(() {
                        _condition = value;
                      });
                    },
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: _locationController,
              decoration: const InputDecoration(labelText: 'Location address'),
            ),
            const SizedBox(height: 18),
            _buildPriceSection(context),
            const SizedBox(height: 18),
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: _minPeriodController,
                    decoration: const InputDecoration(labelText: 'Min period'),
                    keyboardType: TextInputType.number,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextFormField(
                    controller: _maxPeriodController,
                    decoration: const InputDecoration(labelText: 'Max period'),
                    keyboardType: TextInputType.number,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: _tagsController,
              decoration: const InputDecoration(
                labelText: 'Tags',
                hintText: 'camera, canon, studio',
              ),
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: _termsController,
              minLines: 3,
              maxLines: 5,
              decoration: const InputDecoration(labelText: 'Terms and conditions'),
            ),
            const SizedBox(height: 18),
            Row(
              children: [
                Expanded(
                  child: FilledButton.icon(
                    onPressed: _pickImages,
                    icon: const Icon(Icons.add_photo_alternate_outlined),
                    label: const Text('Add photos'),
                  ),
                ),
              ],
            ),
            if (_selectedImages.isNotEmpty) ...[
              const SizedBox(height: 14),
              SizedBox(
                height: 88,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: _selectedImages.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 12),
                  itemBuilder: (context, index) {
                    final imagePath = _selectedImages[index];
                    return ClipRRect(
                      borderRadius: BorderRadius.circular(18),
                      child: Stack(
                        children: [
                          Image.file(
                            File(imagePath),
                            width: 88,
                            height: 88,
                            fit: BoxFit.cover,
                          ),
                          Positioned(
                            right: 6,
                            top: 6,
                            child: InkWell(
                              onTap: () {
                                setState(() {
                                  _selectedImages.removeAt(index);
                                });
                              },
                              child: Container(
                                padding: const EdgeInsets.all(4),
                                decoration: const BoxDecoration(
                                  color: Colors.black54,
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(
                                  Icons.close,
                                  size: 14,
                                  color: Colors.white,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),
            ],
          ],
        ),
      ),
      bottomNavigationBar: SafeArea(
        minimum: const EdgeInsets.fromLTRB(16, 8, 16, 16),
        child: FilledButton(
          onPressed: _isSubmitting ? null : _submit,
          child: Text(
            _isSubmitting
                ? (_isEditing ? 'Saving...' : 'Submitting...')
                : (_isEditing ? 'Save changes' : 'Submit listing'),
          ),
        ),
      ),
    );
  }

  Widget _buildPriceSection(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Pricing',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
            ),
            const SizedBox(height: 8),
            Text(
              'Add one or more rental rates. The backend requires at least one.',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Colors.black.withOpacity(0.65),
                  ),
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: _priceHourController,
              decoration: const InputDecoration(labelText: 'Price per hour'),
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _priceDayController,
              decoration: const InputDecoration(labelText: 'Price per day'),
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _priceWeekController,
              decoration: const InputDecoration(labelText: 'Price per week'),
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _priceMonthController,
              decoration: const InputDecoration(labelText: 'Price per month'),
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _depositController,
              decoration: const InputDecoration(labelText: 'Security deposit'),
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _pickImages() async {
    final files = await _picker.pickMultiImage();
    if (files.isEmpty) {
      return;
    }

    setState(() {
      _selectedImages = [
        ..._selectedImages,
        ...files.map((file) => file.path),
      ].take(10).toList(growable: false);
    });
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    final pricePerHour = _parseDouble(_priceHourController.text);
    final pricePerDay = _parseDouble(_priceDayController.text);
    final pricePerWeek = _parseDouble(_priceWeekController.text);
    final pricePerMonth = _parseDouble(_priceMonthController.text);

    if (pricePerHour == null &&
        pricePerDay == null &&
        pricePerWeek == null &&
        pricePerMonth == null) {
      _showSnack('Add at least one rental price.');
      return;
    }

    setState(() {
      _isSubmitting = true;
    });

    try {
      final response = _isEditing
          ? await widget.dependencies.products.updateProduct(
              id: widget.existingProduct!.string('id'),
              categoryId: _selectedCategoryId!,
              title: _titleController.text.trim(),
              description: _descriptionController.text.trim(),
              pricePerHour: pricePerHour,
              pricePerDay: pricePerDay,
              pricePerWeek: pricePerWeek,
              pricePerMonth: pricePerMonth,
              securityDeposit: _parseDouble(_depositController.text),
              locationAddress: _nullableText(_locationController.text),
              city: _cityController.text.trim(),
              condition: _condition,
              minRentalPeriod: _parseInt(_minPeriodController.text),
              maxRentalPeriod: _parseInt(_maxPeriodController.text),
              termsConditions: _nullableText(_termsController.text),
              tags: _parsedTags(),
            )
          : await widget.dependencies.products.createProduct(
              categoryId: _selectedCategoryId!,
              title: _titleController.text.trim(),
              description: _descriptionController.text.trim(),
              pricePerHour: pricePerHour,
              pricePerDay: pricePerDay,
              pricePerWeek: pricePerWeek,
              pricePerMonth: pricePerMonth,
              securityDeposit: _parseDouble(_depositController.text),
              locationAddress: _nullableText(_locationController.text),
              city: _cityController.text.trim(),
              condition: _condition,
              minRentalPeriod: _parseInt(_minPeriodController.text),
              maxRentalPeriod: _parseInt(_maxPeriodController.text),
              termsConditions: _nullableText(_termsController.text),
              tags: _parsedTags(),
            );

      final productId = asJsonMap(response['data'])?.string('id');
      if ((productId ?? '').isNotEmpty && _selectedImages.isNotEmpty) {
        await widget.dependencies.products.uploadProductImages(
          productId: productId!,
          filePaths: _selectedImages,
        );
      }

      if (!mounted) {
        return;
      }

      Navigator.of(context).pop(true);
    } catch (error) {
      _showSnack(error.toString());
    } finally {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
        });
      }
    }
  }

  List<String>? _parsedTags() {
    final tags = _tagsController.text
        .split(',')
        .map((tag) => tag.trim())
        .where((tag) => tag.isNotEmpty)
        .toList(growable: false);
    return tags.isEmpty ? null : tags;
  }

  String? _requiredValidator(String? value) {
    if ((value ?? '').trim().isEmpty) {
      return 'This field is required';
    }
    return null;
  }

  double? _parseDouble(String value) {
    final trimmed = value.trim();
    return trimmed.isEmpty ? null : double.tryParse(trimmed);
  }

  int? _parseInt(String value) {
    final trimmed = value.trim();
    return trimmed.isEmpty ? null : int.tryParse(trimmed);
  }

  String? _nullableText(String value) {
    final trimmed = value.trim();
    return trimmed.isEmpty ? null : trimmed;
  }

  void _showSnack(String message) {
    if (!mounted) {
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }
}
