class AppUser {
  const AppUser({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    required this.isActive,
    required this.isVerified,
    this.phone,
    this.avatarUrl,
    this.address,
    this.city,
    this.bio,
  });

  final String id;
  final String name;
  final String email;
  final String role;
  final bool isActive;
  final bool isVerified;
  final String? phone;
  final String? avatarUrl;
  final String? address;
  final String? city;
  final String? bio;

  bool get isAdmin => role == 'admin';
  bool get isOwnerLike => role == 'owner' || role == 'both' || role == 'admin';

  factory AppUser.fromJson(Map<String, dynamic> json) {
    return AppUser(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? 'Unknown user',
      email: json['email'] as String? ?? '',
      role: json['role'] as String? ?? 'renter',
      isActive: json['isActive'] == true,
      isVerified: json['isVerified'] == true,
      phone: json['phone'] as String?,
      avatarUrl: json['avatarUrl'] as String?,
      address: json['address'] as String?,
      city: json['city'] as String?,
      bio: json['bio'] as String?,
    );
  }
}
